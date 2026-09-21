from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InventoryMapLayerTests(unittest.TestCase):
    def test_clustered_inventory_layer_contract(self):
        js = (ROOT / "web" / "inventory-map-layer.js").read_text(encoding="utf-8")
        self.assertIn("markerClusterGroup", js)
        self.assertIn("chunkedLoading: true", js)
        self.assertIn("state.regionInventories", js)
        self.assertIn("whiteblock:inventory-map-ready", js)
        self.assertIn("inventoryMarkersEnabled", js)
        self.assertIn("Kildare", (ROOT / "web" / "region-network.js").read_text(encoding="utf-8"))

    def test_runtime_loads_inventory_map_layer(self):
        runtime = (ROOT / "web" / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("inventory-map-layer.js?v=20260921-1", runtime)
        self.assertIn("loadWhiteblockInventoryMapLayer", runtime)

    def test_map_layer_styles_exist(self):
        css = (ROOT / "web" / "inventory-map-layer.css").read_text(encoding="utf-8")
        self.assertIn(".wb-parking-cluster", css)
        self.assertIn(".wb-inventory-marker.accessible", css)
        self.assertIn(".wb-inventory-marker.ev", css)
        self.assertIn(".wb-inventory-map-control", css)


if __name__ == "__main__":
    unittest.main()
