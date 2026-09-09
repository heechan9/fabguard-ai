from pathlib import Path
import json
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CountryEvidenceCatalogTest(unittest.TestCase):
    def test_catalog_paths_exist_and_are_unique(self):
        catalog = json.loads((ROOT / "results/catalog.json").read_text(encoding="utf-8"))
        self.assertEqual(catalog["schema_version"], "fabguard-evidence-catalog/v1")

        paths = []
        for country_code, country in catalog["countries"].items():
            self.assertRegex(country_code, r"^[a-z]{2}(?:-[a-z]{2})?$")
            self.assertTrue(country["name"])
            for source_id, source in country["sources"].items():
                self.assertTrue(source_id)
                self.assertTrue(source["role"])
                self.assertTrue(source["status"])
                for path in source["canonical_paths"]:
                    self.assertTrue((ROOT / path).exists(), path)
                    paths.append(path)

        self.assertEqual(len(paths), len(set(paths)))

    def test_connected_web_sources_are_catalogued(self):
        catalog = json.loads((ROOT / "results/catalog.json").read_text(encoding="utf-8"))
        summary = json.loads((ROOT / "web/data/global_e2e_summary.json").read_text(encoding="utf-8"))

        indexed = {
            ("gb", "pvlive-national-2025"),
            ("eu-be", "jrc-pvgis-brussels-2020"),
            ("fr", "enedis-national-solar-2024"),
            ("fr", "meteo-france-paris-2024"),
        }
        for country_code, source_id in indexed:
            self.assertIn(source_id, catalog["countries"][country_code]["sources"])

        self.assertEqual(set(summary["sources"]), {
            "pvlive_gb_2025",
            "pvgis_brussels_2020",
            "meteo_france_paris_2024",
            "enedis_france_2024",
        })


if __name__ == "__main__":
    unittest.main()
