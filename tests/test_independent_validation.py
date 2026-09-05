import json
import tempfile
import unittest
from pathlib import Path

from fabguard.independent_validation import (
    IndependentDataContractError,
    IndependentDataSpec,
    inspect_external_csv,
    write_validation_report,
)


VALID_CSV = """sample_id,timestamp,label,feature_000,feature_001
x1,2026-01-01T00:00:00Z,0,1.0,2.0
x2,2026-01-01T00:01:00Z,1,1.5,
"""


class IndependentValidationTest(unittest.TestCase):
    def test_profiles_external_data_without_claiming_model_performance(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "external.csv"
            path.write_text(VALID_CSV, encoding="utf-8")
            report = inspect_external_csv(path, IndependentDataSpec(expected_feature_count=2))
            self.assertEqual(report["evaluation_mode"], "locked_model_candidate")
            self.assertFalse(report["compatibility"]["model_scoring_performed"])
            self.assertEqual(report["dataset"]["samples"], 2)
            self.assertEqual(report["dataset"]["missing_cells"], 1)
            self.assertEqual(len(report["source"]["sha256"]), 64)

    def test_mismatched_feature_contract_is_schema_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "external.csv"
            path.write_text(VALID_CSV, encoding="utf-8")
            report = inspect_external_csv(path, IndependentDataSpec())
            self.assertEqual(report["evaluation_mode"], "schema_only")
            self.assertFalse(report["compatibility"]["exact_declared_feature_names"])

    def test_duplicate_id_invalid_time_and_non_numeric_features_fail_closed(self) -> None:
        cases = [
            VALID_CSV.replace("x2,", "x1,"),
            VALID_CSV.replace("2026-01-01T00:01:00Z", "not-a-time"),
            VALID_CSV.replace("1.5,", "broken,"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            for index, content in enumerate(cases):
                path = Path(directory) / f"bad-{index}.csv"
                path.write_text(content, encoding="utf-8")
                with self.assertRaises(IndependentDataContractError):
                    inspect_external_csv(path, IndependentDataSpec(expected_feature_count=2))

    def test_report_writes_only_to_requested_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "external.csv"
            output = root / "report"
            source.write_text(VALID_CSV, encoding="utf-8")
            write_validation_report(source, output, IndependentDataSpec(expected_feature_count=2))
            payload = json.loads((output / "validation_report.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["dataset"]["fail_count"], 1)
            self.assertTrue((output / "VALIDATION_SUMMARY.md").exists())

    def test_invalid_spec_and_nonbinary_labels_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "external.csv"
            path.write_text(VALID_CSV.replace("x2,2026-01-01T00:01:00Z,1", "x2,2026-01-01T00:01:00Z,0"), encoding="utf-8")
            with self.assertRaises(IndependentDataContractError):
                inspect_external_csv(path, IndependentDataSpec(expected_feature_count=2))
            with self.assertRaises(IndependentDataContractError):
                inspect_external_csv(path, IndependentDataSpec(feature_prefix="", expected_feature_count=2))


if __name__ == "__main__":
    unittest.main()
