from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
BASE = "https://github.com/heechan9/fabguard-ai/blob/main/"


class ReadmeNavigationTest(unittest.TestCase):
    def test_primary_and_secondary_navigation_are_centered_and_clickable(self):
        readme = README.read_text(encoding="utf-8")
        expected_targets = (
            "https://fabguard-ai.vercel.app/",
            f"{BASE}results/v1/RESULTS_SUMMARY.md",
            f"{BASE}docs/PHASE1_ADVANCED_VALIDATION.md",
            f"{BASE}REPRODUCIBILITY.md",
            f"{BASE}ROADMAP.md",
            f"{BASE}docs/MELBOURNE_COLLABORATION.md",
            "https://github.com/heechan9/fabguard-ai#global-data-roadmap",
            "https://github.com/heechan9/fabguard-ai#tool-roles",
            f"{BASE}CONTRIBUTIONS.md",
        )

        primary = readme.split("<!-- primary-navigation -->", 1)[1].split("<!-- /primary-navigation -->", 1)[0]
        secondary = readme.split("<!-- secondary-navigation -->", 1)[1].split("<!-- /secondary-navigation -->", 1)[0]
        for block in (primary, secondary):
            self.assertIn('<p align="center">', block)

        hrefs = re.findall(r'<a href="([^"]+)">', primary + secondary)
        for target in expected_targets:
            with self.subTest(target=target):
                self.assertIn(target, hrefs)
        self.assertNotIn("<div", primary + secondary)

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

    def test_reader_routing_and_rigor_documents_are_prominent(self):
        readme = README.read_text(encoding="utf-8")
        summary_position = readme.index("## 30초 요약")
        global_position = readme.index("## Global data roadmap")
        decision_position = readme.index("## 왜 자동 판정이 아닌가요?")
        self.assertLess(decision_position, global_position)
        self.assertIn("빠르게 훑어보실 분은 아래 표로 충분합니다.", readme[summary_position:global_position])
        for target in ("EXPERIMENT_CONTRACT.md", "docs/TEST_EXPOSURE.md", "docs/FAILURE_GOVERNANCE.md"):
            with self.subTest(target=target):
                self.assertIn(f"]({target})", readme[summary_position:global_position])

    def test_every_repository_local_readme_target_exists(self):
        readme = README.read_text(encoding="utf-8")
        markdown_targets = re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", readme)
        html_targets = re.findall(r'(?:href|src)=["\']([^"\']+)', readme)

        for target in markdown_targets + html_targets:
            parsed = urlparse(target)
            if parsed.scheme in {"http", "https", "mailto"} or target.startswith("#"):
                continue
            local_path = unquote(target.split("#", 1)[0])
            with self.subTest(target=target):
                self.assertTrue((ROOT / local_path).exists(), f"README target does not exist: {target}")

    def test_badge_links_use_canonical_main_urls(self):
        readme = README.read_text(encoding="utf-8")
        badge_targets = re.findall(r'<a href="([^"]+)"><img src="https://img\.shields\.io/', readme)
        self.assertGreaterEqual(len(badge_targets), 5)
        for target in badge_targets:
            with self.subTest(target=target):
                self.assertTrue(target.startswith(BASE), f"badge link is not canonical: {target}")


if __name__ == "__main__":
    unittest.main()
