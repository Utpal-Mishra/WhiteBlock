from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class WhiteBlockSessionControlsUITests(unittest.TestCase):
    def test_runtime_loads_session_controls(self):
        config = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("session-controls.css", config)
        self.assertIn("session-controls.js", config)

    def test_arrival_picker_replaces_native_time_ui_without_breaking_contract(self):
        js = (WEB / "session-controls.js").read_text(encoding="utf-8")
        self.assertIn('document.getElementById("arrival")', js)
        self.assertIn('id = "arrival-trigger"', js)
        self.assertIn('id="arrival-sheet"', js)
        self.assertIn("15-minute slot", js)
        self.assertIn('data-time-offset="0"', js)
        self.assertIn('data-time-offset="60"', js)
        self.assertIn('fireChange(arrivalInput)', js)

    def test_stay_choices_are_high_contrast_fast_select_controls(self):
        js = (WEB / "session-controls.js").read_text(encoding="utf-8")
        css = (WEB / "session-controls.css").read_text(encoding="utf-8")
        for minutes in (60, 120, 180, 240, 360, 480):
            self.assertIn(str(minutes), js)
        self.assertIn("stay-choice", css)
        self.assertIn("stay-choice.active", css)
        self.assertIn("linear-gradient(135deg,var(--lime),var(--green))", css)
        self.assertIn('fireChange(durationInput)', js)

    def test_session_rules_still_read_canonical_values(self):
        rules = (WEB / "session-rules.js").read_text(encoding="utf-8")
        self.assertIn('document.getElementById("duration")', rules)
        self.assertIn('document.getElementById("arrival")', rules)
        self.assertIn('addEventListener("change", refreshSession)', rules)


if __name__ == "__main__":
    unittest.main()
