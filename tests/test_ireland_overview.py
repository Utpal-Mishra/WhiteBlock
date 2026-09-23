from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class IrelandOverviewTests(unittest.TestCase):
    def test_connected_regions_and_national_default(self):
        js = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        self.assertIn('cork: {', js)
        self.assertIn('kildare: {', js)
        self.assertIn('dublin: {', js)
        self.assertIn('state.overviewMode = true', js)
        self.assertIn('Ireland · Connected parking intelligence', js)
        self.assertIn('Connected parking across Ireland', js)
        self.assertIn('Cork · Kildare · Dublin connected', js)

    def test_live_availability_is_not_inferred(self):
        js = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        self.assertIn('Reported available now', js)
        self.assertIn('live-reporting assets only', js)
        self.assertIn('missing capacity is not estimated', js)
        self.assertIn('live occupancy is not inferred where no feed is published', js)

    def test_region_focus_is_browse_not_fake_destination(self):
        js = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        self.assertIn('state.regionFocus = key', js)
        self.assertIn('state.destination = null', js)
        self.assertIn('choose a destination to rank suitable parking', js)
        self.assertIn('state.map.flyTo(region.center, region.zoom', js)

    def test_discover_receives_common_region_ready_events(self):
        js = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        discover = (ROOT / "web" / "discover.js").read_text(encoding="utf-8")
        self.assertIn('whiteblock:region-inventory-ready', js)
        self.assertIn('whiteblock:region-inventory-ready', discover)

    def test_runtime_loads_overview_assets(self):
        runtime = (ROOT / "web" / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn('ireland-overview.css?v=20260923-1', runtime)
        self.assertIn('ireland-overview.js?v=20260923-1', runtime)
        self.assertIn('loadWhiteblockIrelandOverview()', runtime)


if __name__ == "__main__":
    unittest.main()
