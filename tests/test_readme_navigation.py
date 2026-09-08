from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
BASE = "https://github.com/heechan9/fabguard-ai/blob/main/"


class ReadmeNavigationTest(unittest.TestCase):
    def test_primary_and_secondary_navigation_use_canonical_main_urls(self):
        readme = README.read_text(encoding="utf-8")
        expected_urls = (
            "results/v1/RESULTS_SUMMARY.md",
            "docs/PHASE1_ADVANCED_VALIDATION.md",
            "REPRODUCIBILITY.md",
            "ROADMAP.md",
            "docs/MELBOURNE_COLLABORATION.md",
            "README.md#global-data-roadmap",
            "README.md#tool-roles",
            "CONTRIBUTIONS.md",
        )

        for target in expected_urls:
            with self.subTest(target=target):
                self.assertIn(f'href="{BASE}{target}"', readme)

    def test_navigation_file_targets_exist(self):
        targets = (
            "results/v1/RESULTS_SUMMARY.md",
            "docs/PHASE1_ADVANCED_VALIDATION.md",
            "REPRODUCIBILITY.md",
            "ROADMAP.md",
            "docs/MELBOURNE_COLLABORATION.md",
            "CONTRIBUTIONS.md",
        )

        for target in targets:
            with self.subTest(target=target):
                self.assertTrue((ROOT / target).is_file())

    def test_readme_anchor_targets_are_stable(self):
        readme = README.read_text(encoding="utf-8")
        self.assertIn('<a id="global-data-roadmap"></a>', readme)
        self.assertIn('<a id="tool-roles"></a>', readme)


if __name__ == "__main__":
    unittest.main()
