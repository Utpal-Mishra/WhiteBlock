from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class MapEngineV2Tests(unittest.TestCase):
    def test_runtime_loads_versioned_map_engine(self):
        runtime = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("map-engine-v2.js?v=20260921-2", runtime)
        self.assertIn("loadWhiteblockMapEngineV2", runtime)

    def test_all_primary_map_modes_use_maplibre(self):
        source = (WEB / "map-engine-v2.js").read_text(encoding="utf-8")
        self.assertIn('L.maplibreGL({', source)
        self.assertIn('pane: "tilePane"', source)
        self.assertIn('const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty"', source)
        self.assertIn('const TERRAIN_TILE = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png"', source)
        self.assertIn('const SATELLITE_TILE = "https://server.arcgisonline.com/', source)
        self.assertNotIn('L.tileLayer(', source)

    def test_parking_footprint_layer_is_present(self):
        source = (WEB / "map-engine-v2.js").read_text(encoding="utf-8")
        self.assertIn("approximatePolygon", source)
        self.assertIn("upgradeSelectedFootprint", source)
        self.assertIn('way(around:180,', source)
        self.assertIn("Mapped parking footprint · OpenStreetMap", source)
        self.assertIn("estimated display footprint", source)

    def test_basemap_is_below_parking_overlays(self):
        css = (WEB / "map-engine-v2.css").read_text(encoding="utf-8")
        self.assertIn(".leaflet-tile-pane { z-index: 200", css)
        self.assertIn(".leaflet-marker-pane { z-index: 620", css)
        self.assertIn("pointer-events: none !important", css)


if __name__ == "__main__":
    unittest.main()
