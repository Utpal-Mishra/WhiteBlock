from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ingest_dublin_parking_universe_evidence.py"
SPEC = spec_from_file_location("dublin_universe", SCRIPT)
dublin_universe = module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(dublin_universe)


class DublinParkingUniverseEvidenceTests(unittest.TestCase):
    def test_accessible_source_is_real_space_but_not_normal_recommendation(self):
        payload = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-6.2601, 53.3498]},
                "properties": {
                    "Street Name": "Example Street",
                    "Location": "Outside civic building",
                    "Side of Road": "North",
                },
            }],
        }
        rows = dublin_universe.accessible_records(payload)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["asset_class"], "accessible")
        self.assertTrue(row["physical_parking_reported"])
        self.assertTrue(row["represents_exact_parking_space"])
        self.assertEqual(row["access_type"], "disabled_parking_card")
        self.assertFalse(row["recommendation_eligible"])
        self.assertEqual(row["source_key"], "dublin_city_accessible_parking")

    def test_meter_is_evidence_anchor_not_parking_bay(self):
        csv_text = (
            "Terminal Code,Zone Desc,Address,Latitude,Longitude\n"
            "12345,Yellow,Example Road,53.3500,-6.2700\n"
        )
        rows = dublin_universe.meter_records(csv_text)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["evidence_class"], "on_street_parking_meter_anchor")
        self.assertEqual(row["asset_class"], "on_street")
        self.assertFalse(row["represents_exact_parking_space"])
        self.assertFalse(row["recommendation_eligible"])
        self.assertIsNone(row["physical_parking_reported"])
        self.assertEqual(row["terminal_code"], "12345")

    def test_build_keeps_source_types_separate_and_excludes_all_from_find(self):
        accessible = {
            "features": [{
                "geometry": {"coordinates": [-6.25, 53.35]},
                "properties": {"Street Name": "A", "Location": "B"},
            }]
        }
        meters = (
            "Terminal Code,Zone Desc,Address,Latitude,Longitude\n"
            "1,Red,Road A,53.36,-6.26\n"
            "2,Green,Road B,53.37,-6.27\n"
        )
        payload = dublin_universe.build(accessible, meters)
        self.assertEqual(payload["summary"]["evidence_records"], 3)
        self.assertEqual(payload["summary"]["accessible_parking_spaces"], 1)
        self.assertEqual(payload["summary"]["parking_meter_anchors"], 2)
        self.assertEqual(payload["summary"]["recommendation_eligible"], 0)
        self.assertTrue(all(row["recommendation_eligible"] is False for row in payload["records"]))


if __name__ == "__main__":
    unittest.main()
