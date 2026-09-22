import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "web" / "data" / "global_candidates.json"
APP_PATH = ROOT / "web" / "app.js"
READABILITY_PATH = ROOT / "web" / "readability.css"


class GlobalCandidateWebContractTest(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

    def test_registry_contract_and_unique_countries(self):
        self.assertEqual(
            self.registry["schema_version"], "fabguard-global-candidates/v1"
        )
        self.assertEqual(self.registry["status"], "planning_only")
        candidates = self.registry["candidates"]
        self.assertGreater(len(candidates), 0)
        countries = [candidate["country"] for candidate in candidates]
        self.assertEqual(len(countries), len(set(countries)))
        for candidate in candidates:
            for field in ("country", "flag", "sources", "role", "status", "gate"):
                self.assertIsInstance(candidate[field], str)
                self.assertTrue(candidate[field].strip())

    def test_requested_country_coverage(self):
        expected = {
            "United States",
            "France",
            "Germany",
            "Spain",
            "Italy",
            "Canada",
            "Finland",
            "South Korea",
            "Japan",
            "Taiwan",
        }
        actual = {candidate["country"] for candidate in self.registry["candidates"]}
        self.assertEqual(actual, expected)


    def test_registry_remains_planning_only(self):
        text = json.dumps(self.registry).lower()
        self.assertNotIn('"status": "verified"', text)
        self.assertIn("not connection", self.registry["claim_boundary"].lower())

    def test_global_view_distinguishes_data_roles_and_candidate_tones(self):
        app = APP_PATH.read_text(encoding="utf-8")
        css = READABILITY_PATH.read_text(encoding="utf-8")
        for kind in ("observed", "estimated", "reference", "synthetic"):
            self.assertIn(f'dataRole("{kind}"', app)
            self.assertIn(f".data-role--{kind} i", css)
        self.assertIn('class="candidate-top"', app)
        self.assertIn("candidateTone(candidate.status)", app)
        self.assertIn(".candidate-list .flag-img{width:32px;height:24px}", css)

    def test_global_captions_have_twelve_pixel_minimum_override(self):
        css = READABILITY_PATH.read_text(encoding="utf-8")
        self.assertIn(".country-card dt,.country-card dd,.dkasc-evidence span,.dkasc-evidence small{font-size:14px", css)
        self.assertIn(".tool-rail>article>span,.tool-rail>article>b,.candidate-list article em{font-size:12px", css)


if __name__ == "__main__":
    unittest.main()
