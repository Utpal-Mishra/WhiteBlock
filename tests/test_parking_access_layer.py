from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ParkingAccessLayerTests(unittest.TestCase):
    def test_access_taxonomy_and_precision_rules(self):
        js = (ROOT / "web" / "parking-access-layer.js").read_text(encoding="utf-8")
        self.assertIn('public: { group: "public"', js)
        self.assertIn('customer: { group: "customer"', js)
        self.assertIn('destination: { group: "customer"', js)
        self.assertIn('permissive: { group: "conditional"', js)
        self.assertIn('private: { group: "restricted"', js)
        self.assertIn('permit: { group: "restricted"', js)
        self.assertIn('emergency: { group: "restricted"', js)
        self.assertIn('designated: { group: "unknown"', js)
        self.assertIn('Unknown ≠ public', js)
        self.assertIn('recommendationEligible: mapped.group !== "restricted"', js)

    def test_access_filter_defaults_keep_restricted_out(self):
        js = (ROOT / "web" / "parking-access-layer.js").read_text(encoding="utf-8")
        self.assertIn('const DEFAULT_ACTIVE = ["public", "customer", "conditional", "unknown"]', js)
        self.assertIn('state.inventoryAccessFilters', js)
        self.assertIn('whiteblock:parking-access-filtered', js)
        self.assertIn('Public only', js)
        self.assertIn('Show all', js)

    def test_access_layer_styles_and_runtime_load(self):
        css = (ROOT / "web" / "parking-access-layer.css").read_text(encoding="utf-8")
        index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn('.wb-inventory-marker.wb-access-public', css)
        self.assertIn('.wb-inventory-marker.wb-access-customer', css)
        self.assertIn('.wb-inventory-marker.wb-access-unknown', css)
        self.assertIn('.wb-inventory-marker.wb-access-restricted', css)
        self.assertIn('.wb-access-map-control', css)
        self.assertIn('parking-access-layer.js?v=20260923-1', index)
        self.assertLess(index.index('./session-rules.js'), index.index('./parking-access-layer.js'))


if __name__ == "__main__":
    unittest.main()
