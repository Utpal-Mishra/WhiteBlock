from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class WhiteBlockWebUITests(unittest.TestCase):
    def test_frontend_files_exist(self):
        for filename in ("index.html", "styles.css", "app.js"):
            self.assertTrue((WEB / filename).exists(), f"Missing web/{filename}")

    def test_core_views_are_present(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        for view in ("find", "discover", "network", "evidence"):
            self.assertIn(f'data-view-panel="{view}"', html)
        self.assertIn('class="mobile-nav"', html)
        self.assertIn('id="map"', html)
        self.assertIn('id="parking-list"', html)

    def test_shared_project_palette_is_preserved(self):
        css = (WEB / "styles.css").read_text(encoding="utf-8").upper()
        for color in ("#07110D", "#0B1712", "#0E1D17", "#1E3229", "#EDF7F1", "#8FA39A", "#78E6AA", "#52D98D", "#C8F56B"):
            self.assertIn(color, css)

    def test_demo_data_is_explicitly_labelled(self):
        html = (WEB / "index.html").read_text(encoding="utf-8").lower()
        self.assertIn("prototype / demo values", html)


if __name__ == "__main__":
    unittest.main()
