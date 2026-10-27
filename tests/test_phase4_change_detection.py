import importlib.util
import pathlib
import sys
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build_parking_supply_change_report.py"
spec = importlib.util.spec_from_file_location("build_parking_supply_change_report", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class Phase4ChangeDetectionTests(unittest.TestCase):
    def feature(self, lon, lat, area):
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"surface_area_m2": area, "detection_confidence": 0.9},
        }

    def test_appeared_and_disappeared_are_review_candidates(self):
        previous = {"features": [self.feature(-8.47, 51.89, 1000)]}
        current = {"features": [self.feature(-8.49, 51.91, 1000)]}
        rows = module.compare(previous, current, match_radius_m=45, area_change_ratio=0.2)
        types = {row["change_type"] for row in rows}
        self.assertEqual(types, {"appeared", "disappeared_or_obscured"})
        self.assertTrue(all(row["verification_required"] for row in rows))

    def test_area_growth_is_classified_as_expansion(self):
        previous = {"features": [self.feature(-8.47, 51.89, 1000)]}
        current = {"features": [self.feature(-8.47001, 51.89001, 1400)]}
        rows = module.compare(previous, current, match_radius_m=45, area_change_ratio=0.2)
        self.assertEqual(rows[0]["change_type"], "expanded")
        self.assertTrue(rows[0]["verification_required"])

    def test_small_area_change_remains_persisted(self):
        previous = {"features": [self.feature(-8.47, 51.89, 1000)]}
        current = {"features": [self.feature(-8.47001, 51.89001, 1080)]}
        rows = module.compare(previous, current, match_radius_m=45, area_change_ratio=0.2)
        self.assertEqual(rows[0]["change_type"], "persisted")
        self.assertFalse(rows[0]["verification_required"])


if __name__ == "__main__":
    unittest.main()
