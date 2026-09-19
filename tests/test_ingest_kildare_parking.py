import importlib.util
import unittest
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "ingest_kildare_parking.py"
spec = importlib.util.spec_from_file_location("ingest_kildare_parking", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class KildareIngestionTests(unittest.TestCase):
    def test_parse_int(self):
        self.assertEqual(module.parse_int("120 spaces"), 120)
        self.assertEqual(module.parse_int("8"), 8)
        self.assertIsNone(module.parse_int(None))

    def test_osm_location_never_fabricates_availability(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        element = {
            "type": "way",
            "id": 123,
            "timestamp": "2026-09-01T12:00:00Z",
            "center": {"lat": 53.18, "lon": -6.80},
            "tags": {
                "amenity": "parking",
                "name": "Example Car Park",
                "capacity": "125",
                "capacity:disabled": "4",
                "fee": "yes",
                "addr:town": "Newbridge",
            },
        }
        result = module.osm_location(element, now)
        self.assertEqual(result["capacity"], 125)
        self.assertEqual(result["accessible_spaces"], 4)
        self.assertIsNone(result["available_spaces"])
        self.assertEqual(result["area"], "Newbridge")
        self.assertEqual(result["source_key"], "openstreetmap_kildare_parking")

    def test_kildare_bounds_cover_core_county_towns(self):
        b = module.KILDARE_BOUNDS
        for lat, lng in [(53.2158, -6.6669), (53.1815, -6.7966), (52.9916, -6.9856)]:
            self.assertGreaterEqual(lat, b["south"])
            self.assertLessEqual(lat, b["north"])
            self.assertGreaterEqual(lng, b["west"])
            self.assertLessEqual(lng, b["east"])


if __name__ == "__main__":
    unittest.main()
