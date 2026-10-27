import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Phase4WebIntegrationTests(unittest.TestCase):
    def test_discover_loads_phase4_assets(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn("parking-supply-discovery.css", html)
        self.assertIn('id="parking-supply-discovery"', html)
        self.assertIn("parking-supply-discovery.js", html)
        self.assertNotIn('parking-universe.js?v=20261027-2"></script>\\n', html)
        discover = (ROOT / "web" / "discover.js").read_text(encoding="utf-8")
        self.assertIn("whiteblock:phase4-candidates-ready", discover)
        self.assertIn("phase4SupplyCandidates", discover)

    def test_production_imagery_sources_are_fail_closed_by_default(self):
        config = json.loads((ROOT / "config" / "phase4_imagery_sources.json").read_text(encoding="utf-8"))
        esri = config["sources"]["esri_world_imagery_review"]
        automated = config["sources"]["licensed_detection_feed"]
        self.assertFalse(esri["machine_ingestion_allowed"])
        self.assertFalse(automated["machine_ingestion_allowed"])

    def test_phase4_ui_does_not_claim_candidate_recommendability(self):
        js = (ROOT / "web" / "parking-supply-discovery.js").read_text(encoding="utf-8")
        self.assertIn("not recommendable", js)
        self.assertNotIn("recommendation_eligible = true", js)


if __name__ == "__main__":
    unittest.main()
