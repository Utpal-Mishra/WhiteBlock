import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "ingest_cork_county_parking.py"
spec = importlib.util.spec_from_file_location("ingest_cork_county_parking", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CorkCountyIngestionTests(unittest.TestCase):
    def test_query_targets_county_administrative_area(self):
        query = module.overpass_query()
        self.assertIn('area["boundary"="administrative"]["admin_level"="6"]["name"="Cork"]', query)
        self.assertIn('nwr(area.searchArea)["amenity"="parking"]', query)
        self.assertIn("out meta geom", query)
        self.assertNotIn("map_to_area.county", query)
        self.assertNotIn("center tags geom", query)

    def test_query_supports_county_cork_name_fallback(self):
        query = module.overpass_query("County Cork")
        self.assertIn('["name"="County Cork"]', query)

    def test_osm_location_never_fabricates_availability_and_keeps_geometry(self):
        now = datetime(2026, 9, 21, tzinfo=timezone.utc)
        element = {
            "type": "way",
            "id": 12345,
            "timestamp": "2026-09-01T12:00:00Z",
            "geometry": [
                {"lat": 51.7468, "lon": -8.7427},
                {"lat": 51.7468, "lon": -8.7423},
                {"lat": 51.7470, "lon": -8.7423},
                {"lat": 51.7470, "lon": -8.7427},
            ],
            "tags": {
                "amenity": "parking",
                "name": "Example Bandon Car Park",
                "capacity": "80",
                "capacity:disabled": "3",
                "fee": "no",
                "addr:town": "Bandon",
            },
        }
        result = module.osm_location(element, now)
        self.assertEqual(result["capacity"], 80)
        self.assertEqual(result["accessible_spaces"], 3)
        self.assertIsNone(result["available_spaces"])
        self.assertEqual(result["area"], "Bandon")
        self.assertEqual(result["source_key"], "openstreetmap_cork_county_parking")
        self.assertEqual(result["geometry"]["type"], "Polygon")
        ring = result["geometry"]["coordinates"][0]
        self.assertEqual(ring[0], ring[-1])

    def test_relations_do_not_get_fake_single_polygon(self):
        now = datetime(2026, 9, 21, tzinfo=timezone.utc)
        element = {
            "type": "relation",
            "id": 999,
            "timestamp": "2026-09-01T12:00:00Z",
            "geometry": [
                {"lat": 51.7, "lon": -8.7},
                {"lat": 51.8, "lon": -8.7},
                {"lat": 51.8, "lon": -8.6},
            ],
            "tags": {"amenity": "parking", "name": "Multipart Parking"},
        }
        result = module.osm_location(element, now)
        self.assertIsNone(result["geometry"])

    def test_county_bounds_cover_representative_cork_towns(self):
        b = module.CORK_COUNTY_BOUNDS
        towns = [
            (52.1330, -8.6339),  # Mallow
            (51.6227, -8.8861),  # Clonakilty
            (51.6801, -9.4520),  # Bantry
            (51.9517, -7.8456),  # Youghal
            (51.6510, -9.9090),  # Castletownbere
        ]
        for lat, lng in towns:
            self.assertGreaterEqual(lat, b["south"])
            self.assertLessEqual(lat, b["north"])
            self.assertGreaterEqual(lng, b["west"])
            self.assertLessEqual(lng, b["east"])


if __name__ == "__main__":
    unittest.main()
