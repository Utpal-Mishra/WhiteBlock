from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class KildareNetworkUiTests(unittest.TestCase):
    def test_regional_loader_and_kildare_contract(self):
        runtime = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        network = (WEB / "region-network.js").read_text(encoding="utf-8")
        self.assertIn("region-network.js", runtime)
        self.assertIn("kildare_parking_snapshot.json", network)
        self.assertIn("Complete county parking network", network)
        self.assertIn("live availability not connected", network.lower())
        self.assertIn("County Kildare search envelope", network)
        self.assertIn("openstreetmap", network.lower())
        self.assertIn("WB_KILDARE_BOUNDARY_RELATION_ID = 285833", network)

    def test_kildare_is_connected_without_rebranding_static_inventory_as_live(self):
        network = (WEB / "region-network.js").read_text(encoding="utf-8")
        self.assertIn("availability: [\"—\", \"no live occupancy feed connected for Kildare\"]", network)
        self.assertIn("resolveRegion", network)
        self.assertIn("isInKildareCoverage", network)
        self.assertIn("available: null", network)


if __name__ == "__main__":
    unittest.main()
