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

    def envelope_records(self):
        rows = []
        for minute, value in ((0, 8250), (15, None), (30, 8400), (45, None), (60, 8550)):
            timestamp = pd.Timestamp("2024-06-01T12:00:00+02:00") + pd.Timedelta(minutes=minute)
            rows.append({"date_heure": timestamp.isoformat(), "solaire": value, "nature": "Données définitives"})
        return rows

    def test_normalizes_cest_to_utc_and_revision_status(self):
        normalized, audit = normalize_eco2mix_records(self.records(), expected_status="definitive")
        self.assertEqual(len(normalized), 3)
        self.assertEqual(normalized.loc[0, "timestamp_utc"], pd.Timestamp("2024-06-01T10:00:00Z"))
        self.assertEqual(audit["response_cadence_minutes"], 30)
        self.assertEqual(audit["structural_null_rows"], 0)

    def test_filters_documented_quarter_hour_structural_nulls(self):
        normalized, audit = normalize_eco2mix_records(self.envelope_records(), expected_status="definitive")
        self.assertEqual(len(normalized), 3)
        self.assertEqual(audit["input_rows"], 5)
        self.assertEqual(audit["structural_null_rows"], 2)
        self.assertEqual(audit["response_cadence_minutes"], 15)
        self.assertEqual(audit["normalized_rows"], 3)

    def test_non_null_quarter_hour_slot_fails_closed(self):
        bad = self.envelope_records()
        bad[1]["solaire"] = 1
        with self.assertRaisesRegex(RTEEco2MixContractError, "structural slots"):
            normalize_eco2mix_records(bad)

    def test_missing_half_hour_value_fails_closed(self):
        bad = self.envelope_records()
        bad[2]["solaire"] = None
        with self.assertRaisesRegex(RTEEco2MixContractError, "half-hour"):
            normalize_eco2mix_records(bad)

    def test_missing_quarter_hour_envelope_row_fails_closed(self):
        bad = self.envelope_records()
        del bad[1]
        with self.assertRaisesRegex(RTEEco2MixContractError, "continuous 15-minute"):
            normalize_eco2mix_records(bad)

    def test_builds_bounded_request(self):
        params = build_records_params(start_utc="2024-06-01T00:00:00Z", end_utc="2024-06-02T00:00:00Z")
        self.assertEqual(params["limit"], 100)
        with self.assertRaisesRegex(RTEEco2MixContractError, "seven days"):
            build_records_params(start_utc="2024-06-01T00:00:00Z", end_utc="2024-06-09T00:00:00Z")

    def test_invalid_generation_fails_closed(self):
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
            normalize_eco2mix_records(self.records(), expected_status="consolidated")


if __name__ == "__main__":
    unittest.main()
