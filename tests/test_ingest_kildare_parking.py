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

    def test_query_targets_exact_county_boundary(self):
        query = module.overpass_query()
        self.assertEqual(module.KILDARE_OSM_RELATION_ID, 285833)
        self.assertIn("rel(285833)", query)
        self.assertIn("map_to_area.county", query)
        self.assertIn('"amenity"="parking"', query)
        self.assertIn("out meta geom", query)
        self.assertNotIn("KILDARE_BOUNDS", query)

    def test_osm_location_never_fabricates_availability_and_keeps_geometry(self):
        now = datetime(2026, 9, 22, tzinfo=timezone.utc)
        element = {
            "type": "way",
            "id": 123,
            "timestamp": "2026-09-01T12:00:00Z",
            "geometry": [
                {"lat": 53.1799, "lon": -6.8002},
                {"lat": 53.1799, "lon": -6.7998},
                {"lat": 53.1801, "lon": -6.7998},
                {"lat": 53.1801, "lon": -6.8002},
            ],
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
        self.assertEqual(result["geometry"]["type"], "Polygon")
        ring = result["geometry"]["coordinates"][0]
        self.assertEqual(ring[0], ring[-1])

    def test_kildare_bounds_cover_representative_county_towns(self):
        b = module.KILDARE_BOUNDS
        towns = [
            (53.2158, -6.6669),  # Naas
            (53.1815, -6.7966),  # Newbridge
            (52.9916, -6.9856),  # Athy
            (53.3813, -6.5927),  # Maynooth
            (53.1407, -7.0667),  # Monasterevin
            (52.9099, -6.8376),  # Castledermot
        ]
        for lat, lng in towns:
            self.assertGreaterEqual(lat, b["south"])
            self.assertLessEqual(lat, b["north"])
            self.assertGreaterEqual(lng, b["west"])
            self.assertLessEqual(lng, b["east"])


if __name__ == "__main__":
    unittest.main()
