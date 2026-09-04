import unittest

import pandas as pd

from fabguard.integrations import FledgeContractError, normalize_fledge_readings


class FledgeContractTest(unittest.TestCase):
    def test_normalizes_readings_into_stable_table(self) -> None:
        frame = normalize_fledge_readings(
            [
                {
                    "asset_code": "etch-01",
                    "user_ts": "2026-09-04T01:00:00Z",
                    "reading": {"pressure": 1.2, "temperature": None},
                },
                {
                    "asset_code": "etch-01",
                    "user_ts": "2026-09-04T01:01:00Z",
                    "reading": {"pressure": 1.3, "temperature": 22.4},
                },
            ],
            required_measurements=["pressure", "temperature"],
        )

        self.assertEqual(
            list(frame.columns),
            [
                "sample_id",
                "asset_code",
                "event_time",
                "measurement__pressure",
                "measurement__temperature",
            ],
        )
        self.assertEqual(frame.loc[0, "sample_id"], "etch-01:2026-09-04T01:00:00+00:00")
        self.assertTrue(pd.isna(frame.loc[0, "measurement__temperature"]))

    def test_rejects_invalid_edge_envelopes(self) -> None:
        cases = [
            ({"user_ts": "2026-09-04T01:00:00Z", "reading": {}}, "asset_code"),
            ({"asset_code": "etch-01", "reading": {}}, "user_ts or ts"),
            ({"asset_code": "etch-01", "user_ts": "bad", "reading": {}}, "invalid timestamp"),
            (
                {
                    "asset_code": "etch-01",
                    "user_ts": "2026-09-04T01:00:00Z",
                    "reading": {"state": "ok"},
                },
                "numeric or null",
            ),
        ]
        for reading, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(FledgeContractError, message):
                    normalize_fledge_readings([reading])

    def test_rejects_missing_required_measurement_and_duplicate_identity(self) -> None:
        valid = {
            "asset_code": "etch-01",
            "user_ts": "2026-09-04T01:00:00Z",
            "reading": {"pressure": 1.2},
        }
        with self.assertRaisesRegex(FledgeContractError, "temperature"):
            normalize_fledge_readings([valid], required_measurements=["temperature"])
        with self.assertRaisesRegex(FledgeContractError, "duplicate"):
            normalize_fledge_readings([valid, valid])


if __name__ == "__main__":
    unittest.main()
