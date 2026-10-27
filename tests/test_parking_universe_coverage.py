from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build_parking_universe_coverage.py"
SPEC = spec_from_file_location("parking_universe", SCRIPT)
parking_universe = module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(parking_universe)


class ParkingUniverseCoverageTests(unittest.TestCase):
    def setUp(self):
        self.config_path = ROOT / "config" / "parking_universe_sources.json"

    def write_snapshot(self, directory: Path, name: str, rows):
        (directory / name).write_text(json.dumps({"locations": rows}), encoding="utf-8")

    def test_report_keeps_completeness_guardrail_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            shared = {
                "parking_id": "WB-PARK-IE-CORK-1",
                "name": "Town Centre",
                "latitude": 51.9,
                "longitude": -8.47,
                "capacity": 0,
                "access_type": "public",
                "pricing_raw": "Paid",
                "geometry": {"type": "Polygon", "coordinates": []},
            }
            self.write_snapshot(directory, "cork_county_parking_snapshot.json", [shared])
            self.write_snapshot(directory, "parking_snapshot.json", [shared])
            self.write_snapshot(directory, "kildare_parking_snapshot.json", [{
                "parking_id": "WB-PARK-IE-KILDARE-1",
                "name": "Retail customer parking",
                "latitude": 53.16,
                "longitude": -6.91,
                "access_type": "customer",
                "maximum_stay_minutes": 120,
            }])
            self.write_snapshot(directory, "dublin_parking_snapshot.json", [{
                "parking_id": "WB-PARK-IE-DUBLIN-1",
                "name": "Street parking",
                "latitude": 53.35,
                "longitude": -6.26,
                "access_type": "unknown",
            }])
            self.write_snapshot(directory, "wicklow_parking_snapshot.json", [{
                "parking_id": "WB-PARK-IE-WICKLOW-1",
                "name": "Station Car Park",
                "latitude": 52.98,
                "longitude": -6.04,
                "capacity": 50,
                "access_type": "public",
            }])

            report = parking_universe.build_report(self.config_path, directory)
            self.assertEqual(
                report["coverage_claim"],
                "source_and_geography_completeness_progress_not_literal_real_world_completeness",
            )
            self.assertEqual(report["known_assets_across_deployed_snapshots"], 4)
            self.assertEqual(report["regions"]["cork"]["known_assets"], 1)
            self.assertEqual(report["regions"]["cork"]["resolution"]["capacity"]["count"], 1)
            self.assertEqual(report["regions"]["dublin"]["resolution"]["access"]["count"], 0)
            self.assertEqual(
                report["regions"]["kildare"]["asset_class_counts"]["retail_customer"],
                1,
            )
            for region in report["regions"].values():
                score = region["programme_readiness_score"]
                if score is not None:
                    self.assertGreaterEqual(score, 0)
                    self.assertLessEqual(score, 100)
                self.assertIn("not a percentage", region["programme_readiness_note"])

    def test_review_queue_prioritises_unresolved_access_and_preserves_candidates(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            self.write_snapshot(directory, "cork_county_parking_snapshot.json", [{
                "parking_id": "WB-PARK-IE-CORK-CANDIDATE",
                "name": "Retail Parking Candidate",
                "latitude": 51.9,
                "longitude": -8.47,
                "access_type": "unknown",
                "truth_state": "unverified",
            }])
            self.write_snapshot(directory, "kildare_parking_snapshot.json", [])
            self.write_snapshot(directory, "dublin_parking_snapshot.json", [])
            self.write_snapshot(directory, "wicklow_parking_snapshot.json", [])

            report = parking_universe.build_report(self.config_path, directory)
            queue = parking_universe.build_review_queue(self.config_path, directory)

            cork = report["regions"]["cork"]
            self.assertEqual(cork["candidate_count"], 1)
            self.assertEqual(cork["review_queue"]["count"], 1)
            self.assertEqual(cork["review_queue"]["unknown_access"], 1)
            self.assertEqual(report["evidence_review"]["items"], queue["review_items"])
            item = queue["regions"]["cork"]["items"][0]
            self.assertIn("unknown_access", item["reasons"])
            self.assertIn("candidate_state", item["reasons"])
            self.assertGreater(item["priority"], 0)

    def test_phase_15_database_state_migration_exists(self):
        migration = (ROOT / "db" / "migrations" / "006_parking_universe_states.sql").read_text(encoding="utf-8")
        self.assertIn("physical_status", migration)
        self.assertIn("recommendation_status", migration)
        self.assertIn("partnership_status", migration)
        self.assertIn("parking_partner_capability", migration)
        self.assertIn("coverage_classes", migration)

    def test_source_registry_distinguishes_integrated_ready_and_gap(self):
        config = json.loads(self.config_path.read_text(encoding="utf-8"))
        statuses = parking_universe.source_family_status(config, "dublin")
        self.assertEqual(statuses["open_geospatial"], "integrated")
        self.assertEqual(statuses["official_local_authority"], "ready_to_integrate")
        self.assertEqual(statuses["accessible_parking"], "ready_to_integrate")
        self.assertEqual(statuses["retail_customer_parking"], "gap")


if __name__ == "__main__":
    unittest.main()
