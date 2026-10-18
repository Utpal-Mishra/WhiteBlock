"""Offline regression tests for County Wicklow parking sourcing."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("wicklow", ROOT / "scripts" / "ingest_wicklow_county_parking.py")
wicklow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wicklow)


class WicklowInventoryTests(unittest.TestCase):
    def sample(self, osm_id=1, lat=52.9808, lon=-6.0446, geometry=None, tags=None):
        return {
            "type": "way", "id": osm_id, "center": {"lat": lat, "lon": lon},
            "tags": tags or {"amenity": "parking", "name": "Wicklow Test Car Park"},
            "geometry": geometry or []
        }

    def test_administrative_boundary_and_brays_separate_pilot(self):
        self.assertIn("rel(282760)", wicklow.osm_query())
        self.assertIn("map_to_area", wicklow.osm_query())
        self.assertIn("area.searchArea", wicklow.osm_query())
        self.assertIsNone(wicklow.make_record(self.sample(lat=53.2048, lon=-6.0996), "2026-10-19T00:00:00Z"))

    def test_unknown_values_remain_unknown_and_count_is_not_available(self):
        row = wicklow.make_record(self.sample(), "2026-10-19T00:00:00Z")
        self.assertIsNone(row["capacity"])
        self.assertIsNone(row["available_spaces"])
        self.assertIsNone(row["maximum_stay_minutes"])
        self.assertEqual(row["access_type"], "unknown")
        self.assertEqual(row["area"], "Wicklow Town")

    def test_open_street_way_never_becomes_fabricated_polygon(self):
        points = [{"lat": 52.98, "lon": -6.04}, {"lat": 52.981, "lon": -6.041},
                  {"lat": 52.982, "lon": -6.042}]
        row = wicklow.make_record(self.sample(geometry=points), "2026-10-19T00:00:00Z")
        self.assertIsNone(row["geometry"])

    def test_closed_way_geometry_and_explicit_osm_metadata(self):
        points = [{"lat": 52.98, "lon": -6.04}, {"lat": 52.981, "lon": -6.04},
                  {"lat": 52.981, "lon": -6.041}, {"lat": 52.98, "lon": -6.04}]
        row = wicklow.make_record(self.sample(geometry=points,
                  tags={"amenity": "parking", "access": "customers", "fee": "no", "capacity": "32"}),
                  "2026-10-19T00:00:00Z")
        self.assertEqual(row["geometry"]["type"], "Polygon")
        self.assertEqual(row["capacity"], 32)
        self.assertEqual(row["access_type"], "customers")
        self.assertIsNone(row["available_spaces"])

    def test_build_snapshot_counts_unique_assets_and_is_non_exhaustive(self):
        elements = [self.sample(osm_id=22), self.sample(osm_id=22),
                    self.sample(osm_id=23, lat=53.2048, lon=-6.0996)]
        snapshot = wicklow.build_snapshot(elements, "test-endpoint", "2026-10-19T00:00:00Z")
        self.assertEqual(snapshot["summary"]["locations"], 1)
        self.assertFalse(snapshot["coverage"]["coverage_complete"])
        self.assertFalse(snapshot["summary"]["live_availability"])
        self.assertEqual(snapshot["coverage"]["osm_boundary_relation_id"], 282760)
        self.assertEqual(snapshot["coverage"]["scope"], "county_mapped_inventory_excluding_bray_pilot")

    def test_web_discover_and_ireland_overview_include_county(self):
        index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        overview = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        discover = (ROOT / "web" / "discover.js").read_text(encoding="utf-8")
        self.assertIn("wicklow-network.js", index)
        self.assertIn("wicklow: {", overview)
        self.assertIn("inventories.wicklow", discover)


if __name__ == "__main__":
    unittest.main()
