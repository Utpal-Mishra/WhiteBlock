from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DestinationParkingFocusTests(unittest.TestCase):
    def test_kildare_village_curated_destination_is_registered(self):
        source = (ROOT / "web" / "destination-parking-focus.js").read_text(encoding="utf-8")
        self.assertIn('primary: "Kildare Village"', source)
        self.assertIn('lat: 53.15364', source)
        self.assertIn('lng: -6.91816', source)
        self.assertIn('prioritiseCuratedSuggestions', source)

    def test_destination_search_focuses_mapped_parking_without_inventing_availability(self):
        source = (ROOT / "web" / "destination-parking-focus.js").read_text(encoding="utf-8")
        self.assertIn('RADIUS_STEPS_KM', source)
        self.assertIn('fitDestinationAndParking', source)
        self.assertIn('renderFocusedParking', source)
        self.assertIn('whiteblock:inventory-map-ready', source)
        self.assertIn('Live availability not reported', source)
        self.assertIn('live space availability is not inferred', source)
        self.assertNotIn('item.available =', source)

    def test_runtime_bridge_loads_destination_focus_layer(self):
        source = (ROOT / "web" / "kildare-asset-enrichment.js").read_text(encoding="utf-8")
        self.assertIn('destination-parking-focus.js', source)
        self.assertIn('data-whiteblock-destination-parking-focus', source)


if __name__ == "__main__":
    unittest.main()
