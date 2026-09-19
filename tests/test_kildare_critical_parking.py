from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "enrich_kildare_snapshot.py"
SPEC = importlib.util.spec_from_file_location("enrich_kildare_snapshot", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class KildareCriticalParkingTests(unittest.TestCase):
    def base_snapshot(self):
        return {
            "schema_version": "1.0",
            "generated_at": "2026-09-19T15:00:00Z",
            "coverage": {"country": "IE", "region": "Kildare", "mode": "network_inventory"},
            "sources": {
                "openstreetmap_kildare_parking": {"count": 1, "status": "ok"},
            },
            "summary": {},
            "locations": [
                {
                    "parking_id": "WB-PARK-IE-KILDARE-OSM-W1",
                    "name": "Existing mapped parking",
                    "area": "Kildare",
                    "latitude": 53.16,
                    "longitude": -6.91,
                    "parking_type": "surface",
                    "access_type": "public",
                    "status": "known",
                    "capacity": None,
                    "available_spaces": None,
                    "accessible_spaces": None,
                    "ev_spaces": None,
                    "network_role": "parking_asset",
                }
            ],
        }

    def test_critical_parking_is_always_present(self):
        snapshot = MODULE.enrich(self.base_snapshot())
        by_id = {item["parking_id"]: item for item in snapshot["locations"]}

        required = {
            "WB-PARK-IE-KILDARE-KV-MAIN",
            "WB-PARK-IE-KILDARE-MARKET-SQUARE",
            "WB-PARK-IE-KILDARE-TOP-NOLAN",
            "WB-PARK-IE-KILDARE-ST-BRIGIDS-SQUARE",
        }
        self.assertTrue(required.issubset(by_id))

        village = by_id["WB-PARK-IE-KILDARE-KV-MAIN"]
        self.assertEqual(village["pricing_raw"], "Complimentary guest parking")
        self.assertEqual(village["ev_spaces"], 26)
        self.assertTrue(village["accessibility_available"])
        self.assertIsNone(village["available_spaces"])

        market = by_id["WB-PARK-IE-KILDARE-MARKET-SQUARE"]
        self.assertEqual(market["accessible_spaces"], 1)
        self.assertIn("verify local signage", market["pricing_raw"])

        top_nolan = by_id["WB-PARK-IE-KILDARE-TOP-NOLAN"]
        self.assertEqual(top_nolan["accessible_spaces"], 3)

    def test_summary_tracks_accessible_and_ev_locations(self):
        snapshot = MODULE.enrich(self.base_snapshot())
        self.assertGreaterEqual(snapshot["summary"]["accessible_locations"], 4)
        self.assertGreaterEqual(snapshot["summary"]["ev_locations"], 1)
        self.assertFalse(snapshot["summary"]["live_availability"])


if __name__ == "__main__":
    unittest.main()
