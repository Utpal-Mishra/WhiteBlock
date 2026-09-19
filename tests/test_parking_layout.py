from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ParkingLayoutContractTests(unittest.TestCase):
    def test_layout_assets_are_loaded(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn("parking-layout.css?v=20260919-1", html)
        self.assertIn("parking-layout.js?v=20260919-1", html)
        self.assertLess(html.index("map-fix.js"), html.index("parking-layout.js"))

    def test_layout_is_destination_centred_and_data_driven(self):
        js = (WEB / "parking-layout.js").read_text(encoding="utf-8")
        self.assertIn("currentData()", js)
        self.assertIn("state.destination", js)
        self.assertIn("relativeKm", js)
        self.assertIn("data-parking-layout-id", js)
        self.assertIn("selectParking", js)
        self.assertIn("No parking footprint is inferred", js)

    def test_terrain_is_preferred_default(self):
        js = (WEB / "parking-layout.js").read_text(encoding="utf-8")
        self.assertIn('data-layer="terrain"', js)
        self.assertIn("preferredBasemap", js)


if __name__ == "__main__":
    unittest.main()
