from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class WhiteBlockWebUITests(unittest.TestCase):
    def test_frontend_files_exist(self):
        for filename in (
            "index.html",
            "styles.css",
            "search.css",
            "map-context.css",
            "runtime-config.js",
            "app.js",
            "live-data.js",
            "api-adapter.js",
            "map-fix.js",
        ):
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

    def test_find_view_does_not_ship_demo_parking_values(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        js = (WEB / "app.js").read_text(encoding="utf-8")
        self.assertIn("let parkingData = [];", js)
        self.assertNotIn("City Centre West", js)
        self.assertNotIn("River Quarter", js)
        self.assertNotIn("South Mall", js)
        self.assertNotIn("North Gate", js)
        self.assertIn("No demo availability values are used", html)
        self.assertIn('<script src="./live-data.js"></script>', html)
        self.assertNotIn(">214<", html)
        self.assertNotIn(">92%<", html)

    def test_live_snapshot_contract(self):
        js = (WEB / "live-data.js").read_text(encoding="utf-8")
        self.assertIn("./data/parking_snapshot.json", js)
        self.assertIn("NEARBY_RADIUS_KM", js)
        self.assertIn("confidenceBasis", js)
        self.assertIn("source + freshness + completeness", js)
        self.assertIn("No demo availability values are being substituted", js)
        self.assertIn("whiteblock:data-ready", js)

    def test_api_first_contract(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        config = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        adapter = (WEB / "api-adapter.js").read_text(encoding="utf-8")
        self.assertIn('<script src="./runtime-config.js"></script>', html)
        self.assertIn('<script src="./api-adapter.js"></script>', html)
        self.assertIn("apiBaseUrl", config)
        self.assertIn("/v1/parking/nearby", adapter)
        self.assertIn("snapshot-fallback", adapter)
        self.assertIn("include_restricted", adapter)
        self.assertIn("whiteblock:data-ready", adapter)

    def test_ireland_address_autocomplete_contract(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        js = (WEB / "app.js").read_text(encoding="utf-8")
        map_js = (WEB / "map-fix.js").read_text(encoding="utf-8")
        self.assertIn('id="destination-suggestions"', html)
        self.assertIn('aria-autocomplete="list"', html)
        self.assertIn('id="ireland-overview-button"', html)
        self.assertIn("Ireland Coverage View", map_js)
        self.assertIn("https://photon.komoot.io/api/", js)
        self.assertIn('code === "IE"', js)
        self.assertIn("IRELAND_BOUNDS", js)
        self.assertIn("isInCorkPilot", js)

    def test_map_context_layers_and_street_view_contract(self):
        js = (WEB / "map-fix.js").read_text(encoding="utf-8")
        css = (WEB / "map-context.css").read_text(encoding="utf-8")
        self.assertIn("map-context.css", js)
        self.assertIn("tiles.openfreemap.org/styles/dark", js)
        self.assertIn("maplibre-gl@5", js)
        self.assertIn("maplibreGL", js)
        self.assertIn("tile.openstreetmap.org", js)  # emergency fallback only
        self.assertIn("tile.opentopomap.org", js)
        self.assertIn("World_Imagery", js)
        self.assertIn('label: "Street"', js)
        self.assertIn('kind: "vector"', js)
        self.assertIn('label: "Terrain"', js)
        self.assertIn('label: "Satellite"', js)
        self.assertIn("Street View", js)
        self.assertIn("map_action=pano", js)
        self.assertIn("ResizeObserver", js)
        self.assertIn("invalidateSize", js)
        self.assertIn("focusSelectedParking", js)
        self.assertIn("renderCoverageTint", js)
        self.assertIn("whiteblock:data-ready", js)
        self.assertNotIn("activeTileLayer.redraw", js)
        self.assertIn("wb-map-layer-button", css)
        self.assertIn("wb-map-satellite", css)
        self.assertIn("wb-map-terrain", css)


if __name__ == "__main__":
    unittest.main()
