"""Guards for the offline robot benchmark's independent-session claim."""

import unittest
import tempfile
import sys
import types
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

from fabguard.robot_benchmark import (channel_features, evaluate, load_mapping,
                                      recording_group, training_protocols,
                                      verify_archive_members)


class RobotBenchmarkContractTest(unittest.TestCase):
    def test_disjoint_protocol_excludes_all_test_recording_sessions(self):
        source = pd.DataFrame({
            "segment_id": ["runA_dataLog_1", "runA_dataLog_2", "runB_dataLog_1"],
            "recording_group": ["runA", "runA", "runB"],
        })
        test = pd.DataFrame({
            "segment_id": ["runA_dataLog_3", "runC_dataLog_1"],
            "recording_group": ["runA", "runC"],
        })
        protocols = training_protocols(source, test)
        self.assertEqual(protocols["published_split"], set(source["segment_id"]))
        self.assertEqual(protocols["disjoint_recording_groups"], {"runB_dataLog_1"})
        self.assertEqual(recording_group("runA_dataLog_3"), "runA")

    def test_exact_segment_reuse_is_rejected(self):
        source = pd.DataFrame({"segment_id": ["a_dataLog_1"], "recording_group": ["a"]})
        with self.assertRaisesRegex(ValueError, "identical segments"):
            training_protocols(source, source)

    def test_top_budget_counts_false_alarms_and_handles_ties(self):
        frame = pd.DataFrame({"label": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                              "segment_id": [f"id{i}" for i in range(10)]})
        score = np.array([.1, .9, .2, .1, .1, .1, .1, .1, .1, .1])
        metric = evaluate(frame, score, "test", "source")
        self.assertEqual(metric["top_10_percent"]["inspected"], 1)
        self.assertEqual(metric["top_10_percent"]["captured"], 0)
        self.assertEqual(metric["top_10_percent"]["false_alarms"], 1)
        tied = evaluate(frame, np.ones(10), "test", "source")
        self.assertEqual(tied["top_10_percent"]["captured"], 1)  # id0 wins the tie

    def test_archive_matches_every_extracted_member(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = base / "RoboticArm"
            (root / "train").mkdir(parents=True)
            member = root / "train" / "attributes_normal_source_train.csv"
            member.write_bytes(b"example")
            archive = base / "RoboticArm.7z"
            import zlib
            entry = types.SimpleNamespace(filename="RoboticArm/train/attributes_normal_source_train.csv",
                                          uncompressed=7, crc32=zlib.crc32(b"example"), is_directory=False)

            class Archive:
                def __init__(self, path, mode):
                    self.assert_path = path == archive and mode == "r"

                def __enter__(self):
                    assert self.assert_path
                    return self

                def __exit__(self, *args):
                    pass

                def list(self):
                    return [entry]

            with patch.dict(sys.modules, {"py7zr": types.SimpleNamespace(SevenZipFile=Archive)}):
                result = verify_archive_members(root, archive)
                self.assertEqual(result["members_verified"], 1)
                member.write_bytes(b"changed")
                with self.assertRaisesRegex(ValueError, "member differs"):
                    verify_archive_members(root, archive)

    def test_mapping_rejects_reused_or_misnamed_sensor(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "train").mkdir()
            names = ["a_dataLog_1", "a_dataLog_2"]
            frame = pd.DataFrame({
                "segment_id": names, "split_label": ["Normal_Source_Train"] * 2,
                "anomaly_label": ["normal"] * 2, "domain_shift_op": ["weight00"] * 2,
                "domain_shift_env": ["BckgA"] * 2,
                **{sensor: [f"{sensor}_{name}.parquet" for name in names]
                   for sensor in ("imp23absu_mic", "ism330dhcx_acc", "ism330dhcx_gyro")},
            })
            for sensor in ("imp23absu_mic", "ism330dhcx_acc", "ism330dhcx_gyro"):
                for value in frame[sensor]:
                    (root / "train" / value).touch()
            csv = root / "train" / "attributes_normal_source_train.csv"
            with patch.dict("fabguard.robot_benchmark.SPLITS", {"normal_source_train": (2, 0)}, clear=True):
                frame.to_csv(csv, index=False)
                self.assertEqual(len(load_mapping(root)), 2)
                frame.loc[1, "imp23absu_mic"] = frame.loc[0, "imp23absu_mic"]
                frame.to_csv(csv, index=False)
                with self.assertRaisesRegex(ValueError, "reused sensor file"):
                    load_mapping(root)

    def test_fully_missing_channel_has_zero_valid_fraction(self):
        result = channel_features(np.array([np.nan, np.nan]), "sensor")
        self.assertEqual(result["sensor_valid_fraction"], 0.0)


if __name__ == "__main__":
    unittest.main()
