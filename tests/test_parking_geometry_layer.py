from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ParkingGeometryLayerTests(unittest.TestCase):
    def test_runtime_loads_maplibre_geometry_overlay(self):
        runtime = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("parking-gl-overlay.js?v=20260921-3", runtime)
        self.assertIn("loadWhiteblockParkingGeometry", runtime)
        self.assertNotIn("parking-geometry-layer.js?v=20260921-1", runtime)

    def test_overlay_javascript_syntax(self):
        subprocess.run(
            ["node", "--check", str(WEB / "parking-gl-overlay.js")],
            check=True,
            capture_output=True,
            text=True,
        )

    def test_overlay_numbers_every_ranked_result(self):
        source = (WEB / "parking-gl-overlay.js").read_text(encoding="utf-8")
        self.assertIn("String(index + 1).padStart", source)
        self.assertIn('POINT_LABEL = "whiteblock-ranked-parking-label"', source)
        self.assertIn('"text-field": ["get", "rank"]', source)

    def test_overlay_renders_in_maplibre_not_leaflet_panes(self):
        source = (WEB / "parking-gl-overlay.js").read_text(encoding="utf-8")
        self.assertIn("glMap.addSource", source)
        self.assertIn("glMap.addLayer", source)
        self.assertIn("whiteblock-ranked-parking-fill", source)
        self.assertIn("whiteblock-ranked-parking-line-mapped", source)
        self.assertIn("whiteblock-ranked-parking-line-estimated", source)
        self.assertNotIn("L.polygon(", source)

    def test_overlay_queries_parking_polygons(self):
        source = (WEB / "parking-gl-overlay.js").read_text(encoding="utf-8")
        self.assertIn('way(around:4500,', source)
        self.assertIn('["amenity"="parking"]', source)
        self.assertIn("geometryCache", source)
        self.assertIn("matchGeometry", source)

    def test_overlay_focuses_selected_result(self):
        source = (WEB / "parking-gl-overlay.js").read_text(encoding="utf-8")
        self.assertIn("focusSelected", source)
        self.assertIn("leafMap.setView", source)
        self.assertIn("selectParking.__wbParkingGlOverlayWrapped", source)


if __name__ == "__main__":
    unittest.main()
