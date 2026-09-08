from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
FLAG_CODES = ("us", "au", "gb", "eu", "fr", "kr", "de", "es", "it", "ca", "fi", "jp", "tw")


class WebFlagAssetsTest(unittest.TestCase):
    def test_cross_platform_flag_assets_exist(self):
        for code in FLAG_CODES:
            with self.subTest(code=code):
                path = ROOT / "web" / "assets" / "flags" / f"{code}.svg"
                self.assertTrue(path.is_file())
                self.assertIn("<svg", path.read_text(encoding="utf-8"))

    def test_web_uses_local_images_instead_of_regional_indicator_emoji(self):
        app = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        self.assertIn('`/assets/flags/${code}.svg`', app)
        self.assertNotIn("flagcdn.com", app)
        for emoji in ("🇺🇸", "🇦🇺", "🇬🇧", "🇪🇺", "🇫🇷", "🇰🇷"):
            with self.subTest(emoji=emoji):
                self.assertNotIn(emoji, app)

    def test_flag_asset_license_is_retained(self):
        notice = (ROOT / "web" / "assets" / "flags" / "LICENSE").read_text(encoding="utf-8")
        self.assertIn("flag-icons", notice)
        self.assertIn("The MIT License", notice)


if __name__ == "__main__":
    unittest.main()
