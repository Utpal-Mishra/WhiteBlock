from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class MapEngineV3Tests(unittest.TestCase):
    def test_runtime_loads_cache_busted_persistent_engine(self):
        runtime = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("map-engine-v2.js?v=20260921-3", runtime)
        self.assertIn("loadWhiteblockMapEngineV2", runtime)

    def test_one_persistent_maplibre_layer_switches_styles(self):
        source = (WEB / "map-engine-v2.js").read_text(encoding="utf-8")
        self.assertIn("window.__WHITEBLOCK_MAP_ENGINE_V3__", source)
        self.assertIn("createPersistentBasemap", source)
        self.assertIn("glMap.setStyle(styleFor(key)", source)
        self.assertIn('const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty"', source)
        self.assertIn('const TERRAIN_TILE = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png"', source)
        self.assertIn('const SATELLITE_TILE = "https://server.arcgisonline.com/', source)
        self.assertNotIn('pane: "tilePane"', source)
        self.assertNotIn("L.tileLayer(", source)

    def test_blank_canvas_css_overrides_are_removed(self):
        css = (WEB / "map-engine-v2.css").read_text(encoding="utf-8")
        self.assertIn("Do not force MapLibre width/height/z-index", css)
        self.assertNotIn("width: 100% !important", css)
        self.assertNotIn("height: 100% !important", css)
        self.assertNotIn("z-index: 0 !important", css)

    def test_parking_footprints_stay_above_basemap(self):
        source = (WEB / "map-engine-v2.js").read_text(encoding="utf-8")
        css = (WEB / "map-engine-v2.css").read_text(encoding="utf-8")
        self.assertIn("approximatePolygon", source)
        self.assertIn("upgradeSelectedFootprint", source)
        self.assertIn('way(around:180,', source)
        self.assertIn("Mapped parking footprint · OpenStreetMap", source)
        self.assertIn("estimated footprint", source)
        self.assertIn("wbParkingAreaPane", css)
        self.assertIn("wbSelectedAreaPane", css)
        self.assertIn("wbParkingPointPane", css)

    def test_map_has_provider_independent_fallback(self):
        source = (WEB / "map-engine-v2.js").read_text(encoding="utf-8")
        self.assertIn("activateLayoutFallback", source)
        self.assertIn("wb-parking-layout-button", source)
        self.assertIn("isStyleLoaded", source)


if __name__ == "__main__":
    unittest.main()
