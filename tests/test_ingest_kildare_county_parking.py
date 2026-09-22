import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "ingest_kildare_county_parking.py"
spec = importlib.util.spec_from_file_location("ingest_kildare_county_parking", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class KildareCountyProductionIngestionTests(unittest.TestCase):
    def test_query_uses_valid_admin_level_six_area_selector(self):
        query = module.overpass_query("Kildare")
        self.assertIn('area["boundary"="administrative"]', query)
        self.assertIn('["admin_level"="6"]', query)
        self.assertIn('["name"="Kildare"]', query)
        self.assertIn('nwr(area.searchArea)["amenity"="parking"]', query)
        self.assertIn("out meta geom", query)
        self.assertNotIn("map_to_area", query)

    def test_county_name_fallback_is_preserved(self):
        self.assertEqual(module.COUNTY_NAMES, ("Kildare", "County Kildare"))
        self.assertEqual(module.base.KILDARE_OSM_RELATION_ID, 285833)


if __name__ == "__main__":
    unittest.main()
