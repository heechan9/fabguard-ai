import unittest

import pandas as pd

from fabguard.integrations.rte_eco2mix_contract import (
    RTEEco2MixContractError,
    build_records_params,
    normalize_eco2mix_records,
)


class RTEEco2MixContractTest(unittest.TestCase):
    def records(self):
        return [
            {"date_heure": "2024-06-01T12:00:00+02:00", "solaire": 8250, "nature": "Données définitives"},
            {"date_heure": "2024-06-01T12:30:00+02:00", "solaire": 8400, "nature": "Données définitives"},
            {"date_heure": "2024-06-01T13:00:00+02:00", "solaire": 8550, "nature": "Données définitives"},
        ]

    def test_normalizes_cest_to_utc_and_revision_status(self):
        normalized, audit = normalize_eco2mix_records(
            self.records(), expected_status="definitive"
        )
        self.assertEqual(len(normalized), 3)
        self.assertEqual(normalized.loc[0, "timestamp_utc"], pd.Timestamp("2024-06-01T10:00:00Z"))
        self.assertEqual(audit["source_type"], "estimated")
        self.assertEqual(audit["revision_status_counts"], {"definitive": 3})
        self.assertEqual(audit["power_unit"], "MW")

    def test_builds_bounded_request(self):
        params = build_records_params(
            start_utc="2024-06-01T00:00:00Z",
            end_utc="2024-06-02T00:00:00Z",
        )
        self.assertEqual(params["limit"], 100)
        self.assertIn("date_heure", params["where"])
        with self.assertRaisesRegex(RTEEco2MixContractError, "seven days"):
            build_records_params(
                start_utc="2024-06-01T00:00:00Z",
                end_utc="2024-06-09T00:00:00Z",
            )

    def test_missing_or_invalid_generation_fails_closed(self):
        bad = self.records()
        del bad[0]["solaire"]
        with self.assertRaisesRegex(RTEEco2MixContractError, "solaire contains missing"):
            normalize_eco2mix_records(bad)

        bad = self.records()
        bad[0]["solaire"] = -1
        with self.assertRaisesRegex(RTEEco2MixContractError, "negative"):
            normalize_eco2mix_records(bad)

    def test_duplicate_gap_and_unknown_revision_fail_closed(self):
        bad = self.records()
        bad[1]["date_heure"] = bad[0]["date_heure"]
        with self.assertRaisesRegex(RTEEco2MixContractError, "duplicate"):
            normalize_eco2mix_records(bad)

        bad = self.records()
        bad[1]["date_heure"] = "2024-06-01T13:30:00+02:00"
        with self.assertRaisesRegex(RTEEco2MixContractError, "continuous"):
            normalize_eco2mix_records(bad)

        bad = self.records()
        bad[0]["nature"] = "temps réel"
        with self.assertRaisesRegex(RTEEco2MixContractError, "unsupported"):
            normalize_eco2mix_records(bad)

    def test_status_mismatch_fails_closed(self):
        with self.assertRaisesRegex(RTEEco2MixContractError, "differs"):
            normalize_eco2mix_records(
                self.records(), expected_status="consolidated"
            )


if __name__ == "__main__":
    unittest.main()
