from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class WhiteBlockWebUITests(unittest.TestCase):
    def test_frontend_files_exist(self):
        for filename in ("index.html", "styles.css", "search.css", "map-context.css", "app.js", "map-fix.js"):
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
        self.assertIn("parking recommendations currently use the cork pilot dataset", html)

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
        self.assertIn("tile.openstreetmap.org", js)
        self.assertIn("tile.opentopomap.org", js)
        self.assertIn("World_Imagery", js)
        self.assertIn('label: "Street"', js)
        self.assertIn('label: "Terrain"', js)
        self.assertIn('label: "Satellite"', js)
        self.assertIn("tileerror", js)
        self.assertIn("fallbackUrl", js)
        self.assertIn("Street View", js)
        self.assertIn("map_action=pano", js)
        self.assertIn("ResizeObserver", js)
        self.assertIn("invalidateSize", js)
        self.assertIn("focusSelectedParking", js)
        self.assertIn("renderCoverageTint", js)
        self.assertNotIn("activeTileLayer.redraw", js)
        self.assertIn("wb-map-layer-button", css)
        self.assertIn("wb-map-satellite", css)
        self.assertIn("wb-map-terrain", css)


if __name__ == "__main__":
    unittest.main()
