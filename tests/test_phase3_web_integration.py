import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Phase3WebIntegrationTests(unittest.TestCase):
    def test_phase3_script_is_loaded_after_session_rules(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        session_index = html.index("session-rules.js")
        phase3_index = html.index("availability-intelligence.js")
        self.assertGreater(phase3_index, session_index)

    def test_phase3_forecast_is_explicitly_not_used_for_ranking(self):
        js = (ROOT / "web" / "availability-intelligence.js").read_text(encoding="utf-8")
        self.assertIn("not yet used to rank", js)
        self.assertIn("ranking disabled until evaluation", js)
        self.assertNotIn("score = function", js)


if __name__ == "__main__":
    unittest.main()
