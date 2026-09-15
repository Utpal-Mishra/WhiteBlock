import pathlib
import sys
import unittest

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from ingest_dublin_vms import parse_geojson  # noqa: E402
from record_guidance_reading import agreement_score, parse_timestamp  # noqa: E402


class ParkingGuidanceTests(unittest.TestCase):
    def test_vms_geojson_parser_normalises_official_style_fields(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [-6.2603, 53.3498]},
                    "properties": {"Equipment Id": "VMS-101", "Location Name": "Quays Test Sign"},
                }
            ],
        }
        rows = parse_geojson(payload)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["display_id"], "WB-VMS-IE-DUB-VMS-101")
        self.assertEqual(rows[0]["name"], "Quays Test Sign")
        self.assertAlmostEqual(rows[0]["latitude"], 53.3498)
        self.assertAlmostEqual(rows[0]["longitude"], -6.2603)

    def test_parser_skips_non_point_features(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "geometry": {"type": "LineString", "coordinates": []}, "properties": {}},
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-6.2, 53.3]}, "properties": {}},
            ],
        }
        self.assertEqual(len(parse_geojson(payload)), 1)

    def test_agreement_score_uses_capacity_when_known(self):
        self.assertAlmostEqual(agreement_score(110, 112, 400), 0.995)
        self.assertEqual(agreement_score(50, 50, None), 1.0)

    def test_iso_timestamp_supports_z_suffix(self):
        parsed = parse_timestamp("2026-09-15T20:00:00Z")
        self.assertIsNotNone(parsed.tzinfo)

    def test_guidance_web_layer_declares_location_only_semantics(self):
        js = (SCRIPTS.parent / "web" / "guidance-layer.js").read_text(encoding="utf-8")
        self.assertIn("live display value not exposed", js)
        self.assertIn("dublin-city-council-variable-message-signs", js)
        self.assertIn("Guidance ·", js)


if __name__ == "__main__":
    unittest.main()
