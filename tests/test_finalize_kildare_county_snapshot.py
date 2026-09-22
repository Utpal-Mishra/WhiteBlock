import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "finalize_kildare_county_snapshot.py"
spec = importlib.util.spec_from_file_location("finalize_kildare_county_snapshot", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class KildareCountyFinalizerTests(unittest.TestCase):
    def base_snapshot(self):
        return {
            "coverage": {"region": "Kildare"},
            "sources": {
                "openstreetmap_kildare_parking": {
                    "status": "ok",
                    "query_mode": "exact_county_boundary",
                    "relation_id": 285833,
                }
            },
            "locations": [
                {
                    "parking_id": "WB-PARK-IE-KILDARE-OSM-W1",
                    "capacity": 40,
                    "accessible_spaces": 2,
                    "ev_spaces": 1,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[-6.8, 53.1], [-6.79, 53.1], [-6.79, 53.11], [-6.8, 53.1]]],
                    },
                },
                {
                    "parking_id": "WB-ACC-IE-KILDARE-KCC-00001",
                    "capacity": None,
                    "accessible_spaces": 1,
                    "geometry": None,
                },
            ],
        }

    def test_finalize_preserves_exact_county_contract_and_geometry_count(self):
        snapshot = module.finalize(self.base_snapshot())
        self.assertEqual(snapshot["coverage"]["scope"], "county_wide_network")
        self.assertEqual(snapshot["coverage"]["osm_boundary_relation_id"], 285833)
        self.assertEqual(snapshot["summary"]["locations"], 2)
        self.assertEqual(snapshot["summary"]["mapped_polygon_locations"], 1)
        self.assertEqual(snapshot["summary"]["known_capacity"], 40)
        self.assertFalse(snapshot["summary"]["live_availability"])

    def test_finalize_rejects_bbox_or_wrong_boundary_source(self):
        snapshot = self.base_snapshot()
        snapshot["sources"]["openstreetmap_kildare_parking"]["query_mode"] = "coverage_bbox_fallback"
        with self.assertRaises(RuntimeError):
            module.finalize(snapshot)

    def test_finalize_rejects_missing_mapped_geometry(self):
        snapshot = self.base_snapshot()
        for item in snapshot["locations"]:
            item["geometry"] = None
        with self.assertRaises(RuntimeError):
            module.finalize(snapshot)


if __name__ == "__main__":
    unittest.main()
