import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build_parking_supply_discovery.py"
spec = importlib.util.spec_from_file_location("build_parking_supply_discovery", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class Phase4SupplyDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "pilot_region": "Cork",
            "candidate_country": "IE",
            "minimum_detection_confidence": 0.65,
            "same_location_radius_m": 25,
            "known_asset_match_radius_m": 75,
            "manual_followup_actions": ["candidate_polygon_allowed", "field_verification_required"],
        }
        self.known = [{
            "parking_id": "WB-PARK-IE-CORK-000001",
            "name": "Known",
            "latitude": 51.8985,
            "longitude": -8.4756,
            "region": "Cork",
        }]
        self.sources = {
            "sources": {
                "licensed_test": {
                    "machine_ingestion_allowed": True,
                    "licence_status": "approved",
                },
                "blocked_test": {
                    "machine_ingestion_allowed": False,
                    "licence_status": "not_verified",
                },
            }
        }

    def batch(self, source_key, lon=-8.4756, lat=51.8985, confidence=0.9):
        return {
            "type": "FeatureCollection",
            "source_key": source_key,
            "imagery_id": "IMG-1",
            "imagery_acquisition_date": "2026-09-01",
            "model_name": "parking-segmentation",
            "model_version": "v1",
            "region": "Cork",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {"detection_confidence": confidence},
            }],
        }

    def test_unlicensed_detection_source_fails_closed(self):
        with self.assertRaises(ValueError):
            module.automated_candidates(
                self.batch("blocked_test"), self.config, self.sources, self.known,
                created_at="2026-10-27T13:00:00Z"
            )

    def test_detection_near_known_asset_is_not_new_public_parking(self):
        rows = module.automated_candidates(
            self.batch("licensed_test"), self.config, self.sources, self.known,
            created_at="2026-10-27T13:00:00Z"
        )
        self.assertEqual(rows[0]["candidate_state"], "matched_known_asset_review")
        self.assertEqual(rows[0]["match"]["parking_id"], "WB-PARK-IE-CORK-000001")
        self.assertFalse(rows[0]["recommendation_eligible"])
        self.assertFalse(rows[0]["public_access_verified"])

    def test_far_detection_becomes_unverified_new_supply_candidate(self):
        rows = module.automated_candidates(
            self.batch("licensed_test", lon=-8.49, lat=51.91), self.config, self.sources, self.known,
            created_at="2026-10-27T13:00:00Z"
        )
        self.assertEqual(rows[0]["candidate_state"], "new_supply_candidate")
        self.assertEqual(rows[0]["access_state"], "unknown")
        self.assertFalse(rows[0]["recommendation_eligible"])

    def test_manual_candidate_polygon_review_seeds_geometry_verification(self):
        evidence = {
            "review_id": "WB-IMG-1",
            "records": [{
                "parking_id": "WB-PARK-IE-CORK-000001",
                "region": "Cork",
                "name": "Known",
                "geometry_action": "candidate_polygon_allowed",
                "imagery_acquisition_date": "2025-01-01",
                "confidence": 0.85,
                "review_result": "physical_parking_visible",
            }],
        }
        rows = module.manual_candidates(
            evidence, self.config, self.known, created_at="2026-10-27T13:00:00Z"
        )
        self.assertEqual(rows[0]["candidate_state"], "needs_geometry_verification")
        self.assertEqual(rows[0]["candidate_type"], "geometry_extension")

    def test_snapshot_loader_deduplicates_known_assets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            payload = {
                "coverage": {"region": "Cork"},
                "locations": [{
                    "parking_id": "WB-PARK-IE-CORK-000001",
                    "name": "Known",
                    "latitude": 51.8985,
                    "longitude": -8.4756,
                }],
            }
            (root / "parking_snapshot.json").write_text(json.dumps(payload), encoding="utf-8")
            (root / "cork_parking_snapshot.json").write_text(json.dumps(payload), encoding="utf-8")
            self.assertEqual(len(module.load_known_assets(root)), 1)


if __name__ == "__main__":
    unittest.main()
