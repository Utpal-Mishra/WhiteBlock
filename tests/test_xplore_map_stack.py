from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class XploreMapStackContractTests(unittest.TestCase):
    def test_maplibre_stack_is_loaded_before_whiteblock_app(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")

        leaflet = html.index("leaflet@1.9.4/dist/leaflet.js")
        maplibre = html.index("maplibre-gl@5/dist/maplibre-gl.js")
        bridge = html.index("maplibre-gl-leaflet/leaflet-maplibre-gl.js")
        app = html.index("./app.js")
        adapter = html.index("./map-fix.js?v=20260918-xplore2")

        self.assertLess(leaflet, maplibre)
        self.assertLess(maplibre, bridge)
        self.assertLess(bridge, app)
        self.assertLess(app, adapter)
        self.assertIn("maplibre-gl@5/dist/maplibre-gl.css", html)

    def test_default_street_basemap_uses_xplore_vector_path(self):
        js = (WEB / "map-fix.js").read_text(encoding="utf-8")
        self.assertIn("tiles.openfreemap.org/styles/dark", js)
        self.assertIn("L.maplibreGL", js)
        self.assertIn('kind: "vector"', js)
        self.assertIn('mapEl.dataset.basemapEngine = "vector"', js)
        self.assertIn("vector basemap unavailable; using raster fallback", js)


if __name__ == "__main__":
    unittest.main()
