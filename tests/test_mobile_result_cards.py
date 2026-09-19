from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MobileResultCardContractTests(unittest.TestCase):
    def test_mobile_card_css_prevents_header_collision(self):
        css = (ROOT / "web" / "mobile-result-cards.css").read_text(encoding="utf-8")
        self.assertIn(".parking-top", css)
        self.assertIn("grid-template-columns: minmax(0, 1fr)", css)
        self.assertIn("white-space: normal", css)
        self.assertIn("availability-unreported", css)
        self.assertIn("padding-bottom: 88px", css)

    def test_card_polish_compacts_kildare_ids_and_unknown_availability(self):
        js = (ROOT / "web" / "result-card-polish.js").read_text(encoding="utf-8")
        self.assertIn('replace(/^WB-PARK-IE-KILDARE-/, "WB-KD-")', js)
        self.assertIn('replace(/^WB-ACC-IE-KILDARE-KCC-/, "WB-KD-ACC-")', js)
        self.assertIn('strong.textContent = "Availability not reported"', js)
        self.assertIn('small.remove()', js)

    def test_runtime_loads_card_polish_assets(self):
        runtime = (ROOT / "web" / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("mobile-result-cards.css", runtime)
        self.assertIn("result-card-polish.js", runtime)


if __name__ == "__main__":
    unittest.main()
