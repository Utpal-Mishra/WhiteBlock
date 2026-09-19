import unittest
from datetime import datetime, timezone

from scripts.ingest_kildare_parking import (
    KILDARE_VILLAGE_OSM_ID,
    TOWN_WEEKEND_RULE,
    enrich_kildare_village,
    promote_kildare_town_parking,
)


class KildareParkingEnrichmentTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)

    def test_kildare_village_is_named_and_enriched(self):
        osm = [
            {
                "parking_id": KILDARE_VILLAGE_OSM_ID,
                "name": "Surface parking",
                "area": "County Kildare",
                "latitude": 53.15364,
                "longitude": -6.91816,
                "parking_type": "surface",
                "access_type": "customer",
                "accessible_spaces": 1,
                "ev_spaces": None,
                "observed_at": "2026-06-01T00:00:00Z",
                "evidence": [],
            }
        ]

        result = enrich_kildare_village(osm, self.now)

        self.assertEqual(result["name"], "Kildare Village Parking")
        self.assertEqual(result["access_type"], "customer")
        self.assertEqual(result["ev_spaces"], 26)
        self.assertEqual(result["ev_charging_stations"], 13)
        self.assertEqual(result["ev_charging_power_kw"], 11)
        self.assertIn("Complimentary guest parking", result["pricing_raw"])
        self.assertGreaterEqual(result["accessible_spaces"], 1)

    def test_known_town_accessible_anchor_promotes_parking_asset(self):
        accessible = [
            {
                "parking_id": "WB-ACC-TEST",
                "name": "Top Nolan Car Park",
                "area": "Kildare",
                "latitude": 53.159,
                "longitude": -6.91,
            }
        ]
        osm = []

        promoted = promote_kildare_town_parking(accessible, osm, self.now)

        self.assertEqual(len(promoted), 1)
        item = promoted[0]
        self.assertEqual(item["name"], "Top Nolan Car Park")
        self.assertEqual(item["access_type"], "public")
        self.assertEqual(item["accessible_spaces"], 3)
        self.assertEqual(item["pricing_raw"], TOWN_WEEKEND_RULE)
        self.assertIsNone(item["available_spaces"])
        self.assertIn("Representative point", item["coordinate_basis"])

    def test_town_anchor_enriches_nearby_osm_parking_instead_of_duplicate(self):
        accessible = [
            {
                "parking_id": "WB-ACC-MARKET",
                "name": "Market Square Car Park",
                "area": "Kildare Town",
                "latitude": 53.1580,
                "longitude": -6.9120,
            }
        ]
        osm = [
            {
                "parking_id": "WB-PARK-OSM-MARKET",
                "name": "Surface parking",
                "area": "County Kildare",
                "latitude": 53.15802,
                "longitude": -6.91202,
                "parking_type": "surface",
                "access_type": "unknown",
                "accessible_spaces": None,
                "ev_spaces": None,
                "observed_at": "2026-06-01T00:00:00Z",
                "evidence": [],
            }
        ]

        promoted = promote_kildare_town_parking(accessible, osm, self.now)

        self.assertEqual(promoted[0]["parking_id"], "WB-PARK-OSM-MARKET")
        self.assertEqual(osm[0]["name"], "Market Square Car Park")
        self.assertEqual(osm[0]["accessible_spaces"], 1)
        self.assertEqual(osm[0]["access_type"], "public")
        self.assertIn("Saturday", osm[0]["pricing_raw"])


if __name__ == "__main__":
    unittest.main()
