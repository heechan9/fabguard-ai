import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "web" / "data" / "global_candidates.json"


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
            "Israel",
            "Saudi Arabia",
        }
        actual = {candidate["country"] for candidate in self.registry["candidates"]}
        self.assertEqual(actual, expected)

    def test_middle_east_scope_excludes_unsuitable_sources(self):
        text = json.dumps(self.registry).lower()
        self.assertIn("hot/desert-soiling", text)
        self.assertNotIn("uae", text)
        self.assertNotIn("qatar", text)
        self.assertNotIn("military base", text)

    def test_registry_remains_planning_only(self):
        text = json.dumps(self.registry).lower()
        self.assertNotIn('"status": "verified"', text)
        self.assertIn("not connection", self.registry["claim_boundary"].lower())


if __name__ == "__main__":
    unittest.main()
