import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "ingest_cork_parking.py"
spec = importlib.util.spec_from_file_location("ingest_cork_parking", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


class CorkParkingIngestionTests(unittest.TestCase):
    def sample_row(self):
        return {
            "identifier": "12",
            "name": "Example Car Park",
            "spaces": "100",
            "free_spaces": "25",
            "opening_times": "07:00-23:00",
            "height_restrictions": "2.0m",
            "price": "Example tariff",
            "notes": "",
            "latitude": "51.8985",
            "longitude": "-8.4756",
            "date": "2026-09-11 10:00:00",
        }

    def test_canonical_id_from_official_identifier(self):
        self.assertEqual(module.canonical_id("12"), "WB-PARK-IE-CORK-000012")

    def test_valid_row_passes_quality_checks(self):
        self.assertEqual(module.validate_row(self.sample_row()), [])

    def test_free_spaces_above_capacity_is_quarantined(self):
        row = self.sample_row()
        row["free_spaces"] = "101"
        self.assertIn("free_spaces_exceeds_capacity", module.validate_row(row))

    def test_build_records_separates_asset_and_observation(self):
        inventory, observation = module.build_records(
            self.sample_row(),
            "2026-09-11T10:01:00Z",
            "data/cork/raw/example.csv",
        )
        self.assertEqual(inventory["capacity_verified"], 100)
        self.assertNotIn("available_spaces", inventory)
        self.assertEqual(observation["available_spaces"], 25)
        self.assertEqual(observation["occupied_spaces"], 75)
        self.assertAlmostEqual(observation["occupancy_ratio"], 0.75)
        self.assertEqual(observation["truth_state"], "observed")

    def test_invalid_coordinates_are_quarantined(self):
        row = self.sample_row()
        row["latitude"] = "999"
        self.assertIn("invalid_coordinates", module.validate_row(row))


if __name__ == "__main__":
    unittest.main()
