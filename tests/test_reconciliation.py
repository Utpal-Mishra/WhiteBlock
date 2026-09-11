import pathlib
import sys
import unittest

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from reconcile_source_records import (  # noqa: E402
    MatchCandidate,
    capacity_similarity,
    classify,
    match_score,
)


class ReconciliationTests(unittest.TestCase):
    def test_capacity_similarity_exact(self):
        self.assertEqual(capacity_similarity(100, 100), 1.0)

    def test_capacity_similarity_missing_is_neutral_by_omission(self):
        self.assertIsNone(capacity_similarity(None, 100))

    def test_strong_nearby_name_match_scores_high(self):
        score, cap = match_score(8.0, 0.97, 100, 102, radius_m=150.0)
        self.assertGreater(score, 0.92)
        self.assertGreater(cap, 0.95)

    def test_distance_penalises_otherwise_good_match(self):
        near, _ = match_score(10.0, 0.92, 100, 100, radius_m=150.0)
        far, _ = match_score(140.0, 0.92, 100, 100, radius_m=150.0)
        self.assertGreater(near, far)

    def test_clear_strong_match_auto_links(self):
        best = MatchCandidate("WB-PARK-1", 10.0, 0.96, 100, 0.97, 1.0)
        second = MatchCandidate("WB-PARK-2", 55.0, 0.84, 100, 0.80, 1.0)
        decision, _ = classify(best, second)
        self.assertEqual(decision, "auto_linked")

    def test_ambiguous_match_requires_review(self):
        best = MatchCandidate("WB-PARK-1", 12.0, 0.95, 100, 0.95, 1.0)
        second = MatchCandidate("WB-PARK-2", 14.0, 0.94, 100, 0.91, 1.0)
        decision, _ = classify(best, second)
        self.assertEqual(decision, "review")

    def test_no_candidate_requires_review_not_new_asset(self):
        decision, reason = classify(None, None)
        self.assertEqual(decision, "review")
        self.assertEqual(reason, "no_candidate_within_radius")


if __name__ == "__main__":
    unittest.main()
