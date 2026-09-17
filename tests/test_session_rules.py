from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ParkingSessionRuleTests(unittest.TestCase):
    def test_rule_assets_are_wired_into_find_view(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="./session-rules.css"', html)
        self.assertIn('<script src="./session-rules.js"></script>', html)
        self.assertIn('id="parking-ineligible"', html)
        self.assertIn('<option value="120" selected>2 hours</option>', html)
        self.assertIn('<option value="180">3 hours</option>', html)
        self.assertIn('<option value="360">6 hours</option>', html)

    def test_session_engine_enforces_max_stay_and_access_windows(self):
        js = (WEB / "session-rules.js").read_text(encoding="utf-8")
        self.assertIn("stayMinutes > maxStay", js)
        self.assertIn("Maximum stay", js)
        self.assertIn("sessionFitsWindow", js)
        self.assertIn("Requested session exceeds opening window", js)
        self.assertIn("Near stay limit", js)
        self.assertIn("Does not fit your stay", js)
        self.assertIn("Customers only", js)
        self.assertIn("customer parking rules", js)

    def test_ineligible_options_remain_visible_for_transparency(self):
        js = (WEB / "session-rules.js").read_text(encoding="utf-8")
        css = (WEB / "session-rules.css").read_text(encoding="utf-8")
        self.assertIn("Not suitable for this stay", js)
        self.assertIn("not recommended", js)
        self.assertIn("parking-ineligible-section", css)
        self.assertIn("marker-ineligible", css)

    def test_snapshot_and_api_carry_maximum_stay(self):
        exporter = (ROOT / "scripts" / "export_web_snapshot.py").read_text(encoding="utf-8")
        api = (ROOT / "api" / "app.py").read_text(encoding="utf-8")
        adapter = (WEB / "api-adapter.js").read_text(encoding="utf-8")
        self.assertIn('"maximum_stay_minutes": asset.get("maximum_stay_minutes")', exporter)
        self.assertIn("maximum_stay_minutes: Optional[int]", api)
        self.assertIn("p.maximum_stay_minutes", api)
        self.assertIn("'public', 'customer', 'unknown'", api)
        self.assertIn("maxStayMinutes: numeric(record.maximum_stay_minutes)", adapter)
        self.assertIn("hydrateSnapshotRuleFields", adapter)


if __name__ == "__main__":
    unittest.main()
