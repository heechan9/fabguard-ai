from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
APP = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
STYLE = (ROOT / "web" / "style.css").read_text(encoding="utf-8")


class WebNavigationTest(unittest.TestCase):
    def test_home_and_professional_evidence_are_separate_layers(self):
        self.assertIn('app.querySelector(".global-section")?.remove()', APP)
        self.assertIn('app.querySelectorAll(expertSelectors).forEach(section => section.remove())', APP)
        self.assertIn('방법론과 한계 전체 보기', APP)
        self.assertIn('${professionalEvidenceHtml}</section>', APP)

    def test_global_data_has_its_own_view(self):
        self.assertIn('requestedView === "global"', APP)
        self.assertIn('section.classList.contains("global-section")', APP)

    def test_validation_numbering_and_long_context_are_normalized(self):
        self.assertIn('number.textContent = `06${String.fromCharCode(65 + index)}`', APP)
        self.assertIn('setAttribute("data-validation-step", "04")', APP)
        self.assertIn('setAttribute("data-validation-step", "05")', APP)
        self.assertIn('setAttribute("data-validation-step", "06")', APP)
        self.assertIn('details.className = "validation-details"', APP)
        self.assertIn('combined.className = "operations-combined"', APP)

    def test_navigation_routes_are_implemented(self):
        nav_routes = re.findall(r'<a href="#([^"]+)" data-route="([^"]+)">', INDEX)
        self.assertEqual(
            nav_routes,
            [("summary", "summary"), ("global", "global"), ("risks", "risks"), ("limitations", "limitations")],
        )
        for route, _ in nav_routes:
            with self.subTest(route=route):
                self.assertIn(f'hash === "{route}"', APP)

    def test_direct_section_routes_scroll_after_render(self):
        self.assertIn("window.setTimeout(() =>", APP)
        self.assertIn("}, 50)", APP)
        self.assertIn('hash === "result"', APP)
        self.assertIn('hash === "global"', APP)
        self.assertIn('scrollIntoView({ behavior: "auto", block: "start" })', APP)
        self.assertIn('document.querySelector("#result")?.removeAttribute("id")', APP)

    def test_navigation_exposes_active_page(self):
        self.assertIn('link.setAttribute("aria-current", "page")', APP)
        self.assertIn('nav a[aria-current="page"]', STYLE)

    def test_queue_rows_are_keyboard_operable(self):
        self.assertIn('tabindex="0" role="link"', APP)
        self.assertIn('event.key === "Enter" || event.key === " "', APP)
        self.assertIn("encodeURIComponent(row.dataset.id)", APP)

    def test_mobile_does_not_hide_navigation_items(self):
        self.assertNotIn("nav a:nth-child(2){display:none}", STYLE)
        self.assertIn("grid-template-columns:repeat(4,1fr)", STYLE)

    def test_runtime_assets_and_data_files_exist(self):
        paths = set(re.findall(r'(?:fetch|src=)[(\"]([/][^\"\')]+)', APP))
        paths.update(re.findall(r'(?:href|src)="(/[^"]+)"', INDEX))
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue((ROOT / "web" / path.lstrip("/")).is_file(), f"missing web asset: {path}")


if __name__ == "__main__":
    unittest.main()
