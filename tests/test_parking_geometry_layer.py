from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ParkingGeometryLayerTests(unittest.TestCase):
    def test_runtime_loads_ranked_geometry_layer(self):
        runtime = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("parking-geometry-layer.js?v=20260921-1", runtime)
        self.assertIn("parking-geometry-layer.css?v=20260921-1", runtime)
        self.assertIn("loadWhiteblockParkingGeometry", runtime)

    def test_layer_numbers_every_ranked_result(self):
        source = (WEB / "parking-geometry-layer.js").read_text(encoding="utf-8")
        self.assertIn("wb-ranked-parking-icon", source)
        self.assertIn("String(index + 1).padStart", source)
        self.assertIn("Mapped parking area · OpenStreetMap", source)
        self.assertIn("Estimated display area · geometry not verified", source)

    def test_layer_queries_parking_polygons_in_one_destination_request(self):
        source = (WEB / "parking-geometry-layer.js").read_text(encoding="utf-8")
        self.assertIn('way(around:4500,', source)
        self.assertIn('amenity\"=\"parking', source)
        self.assertIn("geometryCache", source)
        self.assertIn("matchGeometry", source)

    def test_layer_focuses_selected_result(self):
        source = (WEB / "parking-geometry-layer.js").read_text(encoding="utf-8")
        self.assertIn("focusSelected", source)
        self.assertIn("map.setView", source)
        self.assertIn("selectParking.__wbRankedGeometryWrapped", source)


if __name__ == "__main__":
    unittest.main()
