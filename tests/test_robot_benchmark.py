"""Guards for the offline robot benchmark's independent-session claim."""

import unittest

import numpy as np
import pandas as pd

from fabguard.robot_benchmark import evaluate, recording_group, training_protocols


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


if __name__ == "__main__":
    unittest.main()
