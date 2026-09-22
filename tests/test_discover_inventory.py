from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class DiscoverInventoryTests(unittest.TestCase):
    def test_discover_assets_are_loaded(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="./discover.css"', html)
        self.assertIn('<script src="./discover.js"></script>', html)
        self.assertIn('id="discover-region-list"', html)
        self.assertIn('id="discover-location-list"', html)
        self.assertIn('id="discover-regions-value"', html)
        self.assertIn('id="discover-locations-value"', html)
        self.assertIn('id="discover-capacity-value"', html)
        self.assertIn('id="discover-available-value"', html)

    def test_discover_uses_unified_regional_inventory_not_demo_candidate_counts(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        js = (WEB / "discover.js").read_text(encoding="utf-8")
        self.assertNotIn("2 candidate WhiteBlocks identified", html)
        self.assertNotIn("Underused capacity</span><strong>146", html)
        self.assertIn("state.discoveryInventory", js)
        self.assertIn("collectRegionalInventory", js)
        self.assertIn('REGION_LABELS = { cork: "Cork", kildare: "Kildare", dublin: "Dublin" }', js)
        self.assertIn("state.regionInventories.dublin", (WEB / "dublin-network.js").read_text(encoding="utf-8"))
        self.assertIn("whiteblock:data-ready", js)
        self.assertIn("whiteblock:region-inventory-ready", js)
        self.assertIn("View on map", js)

    def test_discover_separates_mapped_inventory_from_unverified_candidates(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        js = (WEB / "discover.js").read_text(encoding="utf-8")
        self.assertIn("added to the WHITEBLOCK data inventory", html)
        self.assertIn('return "candidate"', js)
        self.assertIn('return "mapped"', js)
        self.assertIn("Candidate · not verified", js)
        self.assertIn("mapped parking inventory", js)

    def test_discover_is_safe_for_dublin_scale(self):
        js = (WEB / "discover.js").read_text(encoding="utf-8")
        self.assertIn("const PAGE_SIZE = 100", js)
        self.assertIn("discoveryVisibleLimit", js)
        self.assertIn("Show ${formatInteger", js)
        self.assertIn("corkCounty", js)
        self.assertIn("Do not add `corkCounty` a second time", js)

    def test_discover_preserves_access_uncertainty(self):
        js = (WEB / "discover.js").read_text(encoding="utf-8")
        self.assertIn('return "unknown"', js)
        self.assertIn("Access unknown", js)
        self.assertIn("Customers only", js)
        self.assertIn("discoverAccessState", js)
        self.assertIn('["private", "permit", "restricted", "no", "destination"]', js)
        self.assertNotIn('["yes", "public", "permissive", "destination"]', js)

    def test_discover_exposes_dublin_and_evidence_filters(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn("Discover hidden parking supply.", html)
        self.assertIn('data-discover-filter-group="region"', html)
        self.assertIn('data-discover-filter="dublin"', html)
        self.assertIn('data-discover-filter-group="access"', html)
        self.assertIn('data-discover-filter="customer"', html)
        self.assertIn('data-discover-filter="unknown"', html)
        self.assertIn('data-discover-filter-group="supply"', html)
        self.assertIn('data-discover-filter="candidate"', html)


if __name__ == "__main__":
    unittest.main()
