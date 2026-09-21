from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ParkingGlOverlayContractTests(unittest.TestCase):
    def test_ranked_geometry_is_same_canvas_as_basemap(self):
        source = (WEB / "parking-gl-overlay.js").read_text(encoding="utf-8")
        self.assertIn("glMap.addSource", source)
        self.assertIn("glMap.addLayer", source)
        self.assertIn("style.load", source)
        self.assertIn("whiteblock-ranked-parking-fill", source)
        self.assertIn("whiteblock-ranked-parking-point", source)

    def test_estimated_geometry_is_immediate_and_osm_can_upgrade_it(self):
        source = (WEB / "parking-gl-overlay.js").read_text(encoding="utf-8")
        self.assertIn("estimatedRing", source)
        self.assertIn("fetchParkingGeometry", source)
        self.assertIn("matchGeometry", source)
        self.assertIn("Mapped", (ROOT / "docs" / "PARKING_MAP_RENDERING.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
