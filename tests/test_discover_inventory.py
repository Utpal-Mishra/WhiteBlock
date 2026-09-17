from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class DiscoverInventoryTests(unittest.TestCase):
    def test_discover_assets_are_loaded(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="./discover.css"', html)
        self.assertIn('<script src="./discover.js"></script>', html)
        self.assertIn('id="discover-region-list"', html)
        self.assertIn('id="discover-location-list"', html)
        self.assertIn('id="discover-regions-value"', html)
        self.assertIn('id="discover-locations-value"', html)
        self.assertIn('id="discover-capacity-value"', html)
        self.assertIn('id="discover-available-value"', html)

    def test_discover_uses_inventory_data_not_demo_candidate_counts(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        js = (WEB / "discover.js").read_text(encoding="utf-8")
        self.assertNotIn("2 candidate WhiteBlocks identified", html)
        self.assertNotIn("Underused capacity</span><strong>146", html)
        self.assertIn("state.discoveryInventory", js)
        self.assertIn("whiteblock:data-ready", js)
        self.assertIn("Region added", js)
        self.assertIn("Locations added", html)
        self.assertIn("View on map", js)

    def test_discover_distinguishes_inventory_addition_from_physical_discovery(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        js = (WEB / "discover.js").read_text(encoding="utf-8")
        self.assertIn("added to the WHITEBLOCK data inventory", html)
        self.assertIn("not newly constructed or newly discovered physical parking", js)


if __name__ == "__main__":
    unittest.main()
