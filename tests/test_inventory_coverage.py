from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class InventoryCoverageContractTests(unittest.TestCase):
    def test_inventory_coverage_aggregates_kildare_and_cork(self):
        source = (ROOT / "web" / "inventory-coverage.js").read_text(encoding="utf-8")
        self.assertIn("regions.cork", source)
        self.assertIn("regions.kildare", source)
        self.assertIn('return "Kildare"', source)
        self.assertIn('return "Cork"', source)

    def test_inventory_search_is_bounded_for_mobile(self):
        source = (ROOT / "web" / "inventory-coverage.js").read_text(encoding="utf-8")
        self.assertIn("const DISPLAY_LIMIT = 100", source)
        self.assertIn("Search Inventory Coverage", source)
        self.assertIn("inventory-region-filter", source)
        self.assertIn("inventory-status-filter", source)

    def test_candidate_addition_never_promotes_to_inventory(self):
        source = (ROOT / "web" / "inventory-coverage.js").read_text(encoding="utf-8")
        self.assertIn('truthState: "unverified"', source)
        self.assertIn('inventoryStatus: "candidate"', source)
        self.assertIn("available: null", source)
        self.assertIn("confidence: null", source)
        self.assertIn("local unverified review queue", source)

    def test_kildare_candidate_is_geographically_validated(self):
        source = (ROOT / "web" / "inventory-coverage.js").read_text(encoding="utf-8")
        self.assertIn("function insideKildare", source)
        self.assertIn("No matching location was found inside the Kildare coverage area", source)

    def test_runtime_loads_inventory_after_region_network(self):
        runtime = (ROOT / "web" / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn("loadWhiteblockInventoryCoverage", runtime)
        self.assertIn("inventory-coverage.js", runtime)
        self.assertIn("script.addEventListener('load', loadWhiteblockInventoryCoverage", runtime)

    def test_inventory_styles_include_mobile_layout(self):
        css = (ROOT / "web" / "inventory-coverage.css").read_text(encoding="utf-8")
        self.assertIn(".inventory-search-row", css)
        self.assertIn("@media (max-width:720px)", css)
        self.assertIn(".inventory-candidate-form", css)


if __name__ == "__main__":
    unittest.main()
