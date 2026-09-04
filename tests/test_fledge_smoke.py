import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from fabguard.integrations import FledgeContractError
from fabguard.integrations.fledge_smoke import load_readings, run_smoke


class FledgeSmokeTest(unittest.TestCase):
    def test_writes_normalized_csv_and_quality_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "readings.json"
            input_path.write_text(
                json.dumps(
                    {
                        "readings": [
                            {
                                "asset_code": "etch-01",
                                "user_ts": "2026-09-04T01:00:00Z",
                                "reading": {"pressure": 1.2, "temperature": None},
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            report = run_smoke(
                input_path,
                root / "output",
                required_measurements=("pressure", "temperature"),
            )

            self.assertEqual(report["status"], "contract_validated")
            self.assertEqual(report["readings"], 1)
            self.assertEqual(report["missing_measurement_rate"], 0.5)
            normalized = pd.read_csv(root / "output" / "normalized_readings.csv")
            self.assertEqual(normalized.loc[0, "asset_code"], "etch-01")
            saved = json.loads((root / "output" / "quality_report.json").read_text())
            self.assertIn("not a Fledge plugin", saved["claim_boundary"])

    def test_rejects_non_array_payload(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text('{"reading": {}}', encoding="utf-8")
            with self.assertRaisesRegex(FledgeContractError, "readings array"):
                load_readings(path)

    def test_rejects_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text("not-json", encoding="utf-8")
            with self.assertRaisesRegex(FledgeContractError, "invalid JSON"):
                load_readings(path)


if __name__ == "__main__":
    unittest.main()
