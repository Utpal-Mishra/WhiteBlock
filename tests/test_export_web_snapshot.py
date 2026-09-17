import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from scripts.export_web_snapshot import build_snapshot


class ExportWebSnapshotTests(unittest.TestCase):
    def test_build_snapshot_joins_inventory_and_latest_observation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            curated = root / "curated"
            curated.mkdir(parents=True)

            inventory = [
                {
                    "parking_id": "WB-PARK-IE-CORK-000001",
                    "name": "Example Car Park",
                    "location": {"latitude": 51.90, "longitude": -8.47},
                    "access_type": "public",
                    "status": "verified",
                    "capacity_verified": 100,
                    "accessible_spaces": None,
                    "ev_spaces": None,
                    "opening_hours_raw": "24 hours",
                    "height_restriction_raw": "2.0m",
                    "pricing_raw": "€2.50 per hour",
                    "source_notes": "official record",
                    "provenance": [{"confidence": 0.98}],
                }
            ]
            (curated / "parking_inventory.json").write_text(json.dumps(inventory), encoding="utf-8")

            old = {
                "parking_id": "WB-PARK-IE-CORK-000001",
                "observed_at": "2026-01-01T10:00:00Z",
                "retrieved_at": "2026-01-01T10:01:00Z",
                "available_spaces": 40,
                "occupied_spaces": 60,
                "capacity_at_observation": 100,
                "occupancy_ratio": 0.6,
                "confidence": 0.98,
                "truth_state": "observed",
                "source_key": "cork_city_parking_live",
            }
            new = dict(old)
            new.update({"observed_at": "2026-01-01T10:05:00Z", "available_spaces": 35, "occupied_spaces": 65, "occupancy_ratio": 0.65})
            (curated / "parking_observations.jsonl").write_text(
                json.dumps(old) + "\n" + json.dumps(new) + "\n",
                encoding="utf-8",
            )

            manifest = {
                "run_id": "test-run",
                "source_key": "cork_city_parking_live",
                "retrieved_at": "2026-01-01T10:06:00Z",
                "status": "success",
            }
            (root / "latest_run.json").write_text(json.dumps(manifest), encoding="utf-8")

            snapshot = build_snapshot(root)
            self.assertEqual(snapshot["summary"]["locations"], 1)
            self.assertEqual(snapshot["locations"][0]["available_spaces"], 35)
            self.assertEqual(snapshot["locations"][0]["capacity"], 100)
            self.assertEqual(snapshot["locations"][0]["pricing_raw"], "€2.50 per hour")
            self.assertIn("basis", snapshot["locations"][0]["confidence"])
            self.assertGreater(snapshot["locations"][0]["confidence"]["score"], 0)

    def test_snapshot_does_not_expose_raw_snapshot_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            curated = root / "curated"
            curated.mkdir(parents=True)
            (curated / "parking_inventory.json").write_text("[]", encoding="utf-8")
            (curated / "parking_observations.jsonl").write_text("", encoding="utf-8")
            (root / "latest_run.json").write_text(
                json.dumps({"run_id": "test", "source_key": "source", "retrieved_at": "2026-01-01T00:00:00Z", "status": "success"}),
                encoding="utf-8",
            )
            snapshot = build_snapshot(root)
            encoded = json.dumps(snapshot)
            self.assertNotIn("raw_snapshot", encoded)
            self.assertNotIn("raw_sha256", encoded)


if __name__ == "__main__":
    unittest.main()
