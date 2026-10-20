from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class IrelandOverviewTests(unittest.TestCase):
    def test_connected_regions_and_national_default(self):
        js = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        self.assertIn('cork: {', js)
        self.assertIn('kildare: {', js)
        self.assertIn('dublin: {', js)
        self.assertIn('wicklow: {', js)
        self.assertNotIn('    bray: {', js)
        self.assertIn('state.overviewMode = true', js)
        self.assertIn('Ireland · Connected parking intelligence', js)
        self.assertIn('Connected parking across Ireland', js)
        self.assertIn('Object.values(CONNECTED_REGIONS).map(region => region.label)', js)
        self.assertIn('snapshotRows', js)
        self.assertIn('publishedLocationCount', js)
        self.assertIn('wbOverviewPane', js)

    def test_bray_is_only_a_wicklow_locality_not_a_county_coverage_marker(self):
        base = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        overview = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        discover = (ROOT / "web" / "discover.js").read_text(encoding="utf-8")
        index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        bray = (ROOT / "web" / "bray-adapter.js").read_text(encoding="utf-8")
        self.assertNotIn('{ name: "Bray", lat:', base)
        self.assertIn('Cork · Kildare · Dublin · Wicklow connected (including Bray)', base)
        self.assertIn('Bray Seafront', base)  # Destination search remains usable.
        self.assertNotIn('data-ireland-scope="bray"', overview)
        self.assertNotIn('data-discover-filter="bray"', index)
        self.assertIn('data-discover-filter="wicklow"', index)
        self.assertIn('regionKey === "bray" ? "wicklow"', discover)
        self.assertIn('const bray = state.regionInventories?.bray || [];', overview)
        self.assertIn('region: "Wicklow"', bray)
        self.assertIn('app.js?v=20261020-2', index)

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
        self.assertIn('renderCountyParkingMarkers(key, { fit: true })', js)
        self.assertIn('fitCountyParking(key, rows)', js)
        self.assertIn('renderRegionBoundary(key, { fit: true })', js)
        self.assertIn('wbRegionBoundaryPane', js)
        self.assertIn('ireland_region_boundaries.geojson', js)
        self.assertIn('L.geoJSON(feature', js)
        self.assertIn('wb-selected-region-boundary', js)
        self.assertIn('countyParkingRows(key)', js)
        self.assertIn('clusterGroups(visible, MARKER_POLICY.inventoryRadiusPx', js)
        self.assertIn('focusSubarea', js)
        self.assertIn('parking locations', js)
        self.assertIn('wb-location-cluster', js)
        self.assertIn('LOCATIONS', js)

    def test_discover_receives_common_region_ready_events(self):
        js = (ROOT / "web" / "ireland-overview.js").read_text(encoding="utf-8")
        discover = (ROOT / "web" / "discover.js").read_text(encoding="utf-8")
        self.assertIn('whiteblock:region-inventory-ready', js)
        self.assertIn('whiteblock:region-inventory-ready', discover)

    def test_runtime_loads_overview_assets(self):
        runtime = (ROOT / "web" / "runtime-config.js").read_text(encoding="utf-8")
        self.assertIn('ireland-overview.css?v=20261020-3', runtime)
        self.assertIn('ireland-overview.js?v=20261020-7', runtime)
        self.assertIn('loadWhiteblockIrelandOverview()', runtime)


if __name__ == "__main__":
    unittest.main()
