from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ParkingLayoutContractTests(unittest.TestCase):
    def test_layout_assets_are_loaded(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn("parking-layout.css?v=20261004-1", html)
        self.assertIn("parking-layout.js?v=20261004-1", html)
        self.assertLess(html.index("map-fix.js"), html.index("parking-layout.js"))

    def test_layout_is_destination_centred_and_data_driven(self):
        js = (WEB / "parking-layout.js").read_text(encoding="utf-8")
        self.assertIn("currentData()", js)
        self.assertIn("state.destination", js)
        self.assertIn("relativeKm", js)
        self.assertIn("data-parking-layout-id", js)
        self.assertIn("selectParking", js)
        self.assertIn("No parking footprint is inferred", js)

    def test_street_is_preserved_as_default_and_layout_uses_compact_menu(self):
        js = (WEB / "parking-layout.js").read_text(encoding="utf-8")
        self.assertIn('preferredBasemap = "street"', js)
        self.assertNotIn("preferTerrainDefault", js)
        self.assertIn('toolbar.querySelector(".wb-map-layer-menu") || toolbar', js)


if __name__ == "__main__":
    unittest.main()
