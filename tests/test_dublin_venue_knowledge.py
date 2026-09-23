import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "build_dublin_venue_knowledge.py"
spec = importlib.util.spec_from_file_location("build_dublin_venue_knowledge", MODULE_PATH)
venue = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(venue)


class DublinVenueKnowledgeTests(unittest.TestCase):
    def test_fuel_opening_does_not_imply_long_stay(self):
        policy = venue.venue_policy("fuel_station")
        self.assertFalse(policy["open_24_7_is_parking_permission"])
        self.assertTrue(policy["long_stay_requires_explicit_evidence"])
        self.assertEqual(policy["default_use"], "short_customer_stop_only")

    def test_customer_parking_is_conditional(self):
        v = {"name": "Example Fuel", "operator": "Example", "brand": "Example"}
        p = {
            "parking_id": "P1",
            "name": "Example Customer Parking",
            "operator": "Example",
            "access_type": "customer",
            "customer_only": True,
            "general_public_eligible": False,
            "maximum_stay_minutes": 90,
            "opening_hours_raw": "24/7",
            "pricing_raw": None,
            "capacity": 12,
            "source_key": "test",
            "source_url": "https://example.invalid",
        }
        link = venue.parking_link(v, p, 0.03)
        self.assertEqual(link["association_state"], "name_or_operator_match")
        self.assertEqual(link["suggestion_state"], "conditional_customer_parking")
        self.assertIsNone(link["available_spaces"])
        self.assertEqual(link["live_availability_state"], "not_connected")

    def test_proximity_alone_is_not_ownership(self):
        v = {"name": "Alpha Shopping Centre", "operator": None, "brand": None}
        p = {
            "parking_id": "P2",
            "name": "Unrelated Public Car Park",
            "operator": None,
            "access_type": "public",
        }
        link = venue.parking_link(v, p, 0.08)
        self.assertEqual(link["association_state"], "proximity_only")
        self.assertEqual(link["association_truth_state"], "candidate_association")
        self.assertEqual(link["suggestion_state"], "public_parking_nearby")


if __name__ == "__main__":
    unittest.main()
