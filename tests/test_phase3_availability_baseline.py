import importlib.util
import pathlib
import sys
import tempfile
import unittest
from datetime import datetime, timezone

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build_cork_availability_baseline.py"
spec = importlib.util.spec_from_file_location("build_cork_availability_baseline", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class Phase3AvailabilityBaselineTests(unittest.TestCase):
    def observation(self, when, available=20, capacity=100, parking_id="WB-PARK-IE-CORK-000001"):
        return {
            "parking_id": parking_id,
            "observed_at": when,
            "retrieved_at": when,
            "available_spaces": available,
            "occupied_spaces": capacity - available,
            "capacity_at_observation": capacity,
            "occupancy_ratio": (capacity - available) / capacity,
            "source_key": "cork_city_parking_live",
            "source_record_id": 1,
            "truth_state": "observed",
            "confidence": 0.98,
            "model_version": None,
            "raw_snapshot_ref": "example.csv",
            "quality_flags": [],
        }

    def test_merge_history_deduplicates_observations(self):
        row = self.observation("2026-10-27T09:00:00Z")
        merged = module.merge_history(
            [row],
            [dict(row)],
            as_of=datetime(2026, 10, 27, 10, 0, tzinfo=timezone.utc),
            retention_days=90,
        )
        self.assertEqual(len(merged), 1)

    def test_merge_history_removes_stale_and_invalid_rows(self):
        old = self.observation("2026-01-01T09:00:00Z")
        invalid = self.observation("2026-10-27T09:00:00Z", available=120, capacity=100)
        current = self.observation("2026-10-27T09:30:00Z")
        merged = module.merge_history(
            [old, invalid],
            [current],
            as_of=datetime(2026, 10, 27, 10, 0, tzinfo=timezone.utc),
            retention_days=90,
        )
        self.assertEqual([row["observed_at"] for row in merged], ["2026-10-27T09:30:00Z"])

    def test_build_baseline_preserves_empirical_statistics(self):
        rows = [
            self.observation("2026-10-20T08:00:00Z", available=10),
            self.observation("2026-10-21T08:00:00Z", available=20),
            self.observation("2026-10-22T08:00:00Z", available=0),
        ]
        baseline = module.build_baseline(
            rows,
            generated_at=datetime(2026, 10, 27, 10, 0, tzinfo=timezone.utc),
        )
        location = baseline["locations"]["WB-PARK-IE-CORK-000001"]
        self.assertEqual(location["overall"]["samples"], 3)
        self.assertEqual(location["overall"]["mean_available_spaces"], 10)
        self.assertAlmostEqual(location["overall"]["probability_any_space"], 2 / 3, places=4)
        self.assertFalse(baseline["model"]["ranking_enabled"])

    def test_run_writes_history_and_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            current = root / "current.jsonl"
            current.write_text(
                __import__("json").dumps(self.observation("2026-10-27T09:00:00Z")) + "\n",
                encoding="utf-8",
            )
            history = root / "history.jsonl"
            baseline_path = root / "baseline.json"
            result = module.run(
                current,
                None,
                history,
                baseline_path,
                retention_days=90,
                now=datetime(2026, 10, 27, 10, 0, tzinfo=timezone.utc),
            )
            self.assertTrue(history.exists())
            self.assertTrue(baseline_path.exists())
            self.assertEqual(result["coverage"]["eligible_observations"], 1)


if __name__ == "__main__":
    unittest.main()
