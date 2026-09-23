from pathlib import Path
import importlib.util
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "build_dublin_access_research_queue.py"

spec = importlib.util.spec_from_file_location("dublin_access_queue", MODULE_PATH)
queue_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue_module)


class DublinAccessResearchQueueTests(unittest.TestCase):
    def snapshot(self):
        return {
            "schema_version": "1.3",
            "generated_at": "2026-09-23T00:00:00Z",
            "coverage": {
                "scope": "county_wide_network",
                "coverage_claim": "complete_boundary_traversal_not_complete_real_world_inventory",
                "local_authority_relation_ids": {"Dublin City": 1109531},
            },
            "locations": [
                {
                    "id": "a",
                    "local_authority": "Dublin City",
                    "settlement": "Alpha",
                    "settlement_type": "suburb",
                    "access_type": "unknown",
                    "geometry": {"type": "Polygon"},
                    "source_key": "osm",
                },
                {
                    "id": "b",
                    "local_authority": "Dublin City",
                    "settlement": "Alpha",
                    "settlement_type": "suburb",
                    "access_type": "designated",
                    "source_key": "osm",
                },
                {
                    "id": "c",
                    "local_authority": "Dublin City",
                    "settlement": "Alpha",
                    "settlement_type": "suburb",
                    "access_type": "public",
                    "source_key": "osm",
                },
                {
                    "id": "d",
                    "local_authority": "Dublin City",
                    "settlement": "Beta",
                    "settlement_type": "neighbourhood",
                    "access_type": "private",
                    "source_key": "osm",
                },
            ],
        }

    def test_unknown_and_designated_are_research_gaps(self):
        queue = queue_module.build_queue(self.snapshot())
        self.assertEqual(queue["summary"]["parking_assets"], 4)
        self.assertEqual(queue["summary"]["raw_unknown_access_assets"], 1)
        self.assertEqual(queue["summary"]["designated_uncertain_assets"], 1)
        self.assertEqual(queue["summary"]["unknown_access_assets"], 2)
        self.assertEqual(queue["summary"]["settlement_research_rows"], 1)
        row = queue["queue"][0]
        self.assertEqual(row["settlement"], "Alpha")
        self.assertEqual(row["unknown_access_assets"], 2)
        self.assertEqual(row["mapped_parking_assets"], 3)
        self.assertEqual(row["priority"], "P3")

    def test_priority_tiers_are_deterministic(self):
        self.assertEqual(queue_module.priority_tier(100)[0], "P0")
        self.assertEqual(queue_module.priority_tier(50)[0], "P1")
        self.assertEqual(queue_module.priority_tier(20)[0], "P2")
        self.assertEqual(queue_module.priority_tier(1)[0], "P3")

    def test_precision_claim_is_required(self):
        snapshot = self.snapshot()
        snapshot["coverage"]["coverage_claim"] = "complete"
        with self.assertRaises(ValueError):
            queue_module.build_queue(snapshot)


if __name__ == "__main__":
    unittest.main()
