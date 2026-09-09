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
            "enedis_france_2024": "results/enedis-france-national-solar-2024/report.json",
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

        enedis = summary["sources"]["enedis_france_2024"]
        enedis_audit = json.loads(
            (ROOT / "results/enedis-france-national-solar-2024/fetch_audit.json").read_text(encoding="utf-8")
        )
        self.assertEqual(enedis["input_rows"], enedis_audit["normalized_rows"])
        self.assertEqual(enedis["input_sha256"], enedis_audit["normalized_sha256"])
        self.assertEqual(enedis["missing_energy_rows"], enedis_audit["missing_energy_rows"])
        self.assertTrue(enedis["data_quality_warning"])

        meteo = summary["sources"]["meteo_france_paris_2024"]
        audit = json.loads(
            (ROOT / "results/meteo-france-paris-montsouris-2024/fetch_audit.json").read_text(encoding="utf-8")
        )
        self.assertEqual(meteo["status"], audit["status"])
        self.assertEqual(meteo["source_type"], audit["source_type"])
        self.assertEqual(meteo["input_rows"], audit["normalized_rows"])
        self.assertEqual(meteo["sampling_minutes"], audit["sampling_minutes"])
        self.assertEqual(meteo["input_sha256"], audit["normalized_sha256"])
        self.assertTrue(meteo["frictionless_valid"])


if __name__ == "__main__":
    unittest.main()
