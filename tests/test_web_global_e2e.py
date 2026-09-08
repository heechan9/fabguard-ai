from pathlib import Path
import json
import unittest


ROOT = Path(__file__).resolve().parents[1]


class GlobalE2ESummaryTest(unittest.TestCase):
    def test_web_summary_matches_canonical_reports(self):
        summary = json.loads((ROOT / "web/data/global_e2e_summary.json").read_text(encoding="utf-8"))
        cases = {
            "pvlive_gb_2025": "results/pvlive-gb-national-2025/report.json",
            "pvgis_brussels_2020": "results/pvgis-brussels-2020/report.json",
        }
        self.assertEqual(summary["schema_version"], "fabguard-global-e2e/v1")
        self.assertEqual(summary["status"], "cross_source_e2e_validated")
        for key, report_path in cases.items():
            with self.subTest(source=key):
                item = summary["sources"][key]
                report = json.loads((ROOT / report_path).read_text(encoding="utf-8"))
                self.assertEqual(item["status"], report["status"])
                self.assertEqual(item["source_type"], report["source"]["source_type"])
                self.assertEqual(item["input_rows"], report["source"]["input_rows"])
                self.assertEqual(item["sampling_minutes"], report["sdt_report"]["sampling"])
                self.assertEqual(item["frictionless_valid"], report["validation"]["frictionless"]["valid"])
                self.assertEqual(item["input_sha256"], report["source"]["input_sha256"])
                self.assertRegex(item["input_sha256"], r"^[a-f0-9]{64}$")


if __name__ == "__main__":
    unittest.main()
