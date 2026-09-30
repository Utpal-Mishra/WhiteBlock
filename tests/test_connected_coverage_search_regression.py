from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class ConnectedCoverageSearchRegressionTests(unittest.TestCase):
    def test_inventory_coverage_includes_all_connected_regions(self):
        source = (WEB / "inventory-coverage.js").read_text(encoding="utf-8")
        self.assertIn('const CONNECTED_REGIONS = ["Cork", "Kildare", "Dublin"]', source)
        self.assertIn("regions.cork", source)
        self.assertIn("regions.kildare", source)
        self.assertIn("regions.dublin", source)
        self.assertIn('if (regionKey === "dublin") return "Dublin"', source)
        self.assertIn('<option value="dublin">Dublin</option>', source)
        self.assertIn("state.discoveryInventory", source)
        self.assertIn("whiteblock:region-inventory-ready", source)

    def test_connected_coverage_uses_unified_discover_inventory_first(self):
        source = (WEB / "inventory-coverage.js").read_text(encoding="utf-8")
        unified = source.index("Array.isArray(state.discoveryInventory)")
        cork_fallback = source.index("Array.isArray(regions.cork)")
        self.assertLess(unified, cork_fallback)
        self.assertIn('"Four-authority County Dublin evidence"', source)
        self.assertIn('"Exact-boundary mapped network"', source)

    def test_destination_draft_takes_priority_over_overview_refresh(self):
        source = (WEB / "result-card-polish.js").read_text(encoding="utf-8")
        self.assertIn("function installSearchDraftGuard()", source)
        self.assertIn("state.searchDraftActive = true", source)
        self.assertIn("state.overviewMode = false", source)
        self.assertIn('input.addEventListener("input", protectDraft)', source)
        self.assertIn('event.key === "Backspace"', source)
        self.assertIn('event.key === "Delete"', source)

    def test_empty_uncommitted_query_can_restore_ireland_overview(self):
        source = (WEB / "result-card-polish.js").read_text(encoding="utf-8")
        self.assertIn("if (!draft)", source)
        self.assertIn("!state.destination && !state.regionFocus", source)
        self.assertIn("window.WHITEBLOCK_IRELAND_OVERVIEW?.show", source)
        self.assertIn("window.WHITEBLOCK_IRELAND_OVERVIEW.show({ animate: false })", source)


if __name__ == "__main__":
    unittest.main()
