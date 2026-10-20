from pathlib import Path
import importlib.util
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build_ireland_region_boundaries.py"
CONFIG = ROOT / "config" / "ireland_region_boundaries.json"


def load_module():
    spec = importlib.util.spec_from_file_location("whiteblock_region_boundaries", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class RegionBoundaryBuilderTests(unittest.TestCase):
    def test_config_uses_expected_osm_county_relations(self):
        module = load_module()
        config = module.load_config(CONFIG)
        actual = {row["key"]: int(row["relation_id"]) for row in config["regions"]}
        self.assertEqual(actual, {
            "cork": 332631,
            "kildare": 285833,
            "dublin": 282800,
            "wicklow": 282760,
        })

    def test_relation_members_are_stitched_into_geojson_polygon(self):
        module = load_module()
        relation = {
            "type": "relation",
            "id": 332631,
            "members": [
                {"role": "outer", "geometry": [{"lon": 0, "lat": 0}, {"lon": 1, "lat": 0}]},
                {"role": "outer", "geometry": [{"lon": 1, "lat": 1}, {"lon": 0, "lat": 1}]},
                {"role": "outer", "geometry": [{"lon": 1, "lat": 0}, {"lon": 1, "lat": 1}]},
                {"role": "outer", "geometry": [{"lon": 0, "lat": 1}, {"lon": 0, "lat": 0}]},
            ],
        }
        geometry = module.relation_geometry(relation)
        self.assertEqual(geometry["type"], "Polygon")
        ring = geometry["coordinates"][0]
        self.assertGreaterEqual(len(ring), 4)
        self.assertEqual(ring[0], ring[-1])

    def test_feature_collection_preserves_region_key_and_provenance(self):
        module = load_module()
        config = {
            "source": "OpenStreetMap",
            "license": "ODbL",
            "admin_level": 6,
            "regions": [{"key": "cork", "label": "County Cork", "relation_id": 332631, "iso2": "IE-CO"}],
        }
        payload = {"elements": [{
            "type": "relation",
            "id": 332631,
            "members": [{
                "role": "outer",
                "geometry": [
                    {"lon": 0, "lat": 0}, {"lon": 1, "lat": 0},
                    {"lon": 1, "lat": 1}, {"lon": 0, "lat": 1},
                    {"lon": 0, "lat": 0},
                ],
            }],
        }]}
        collection = module.build_feature_collection(config, payload)
        feature = collection["features"][0]
        self.assertEqual(feature["properties"]["region_key"], "cork")
        self.assertEqual(feature["properties"]["osm_relation_id"], 332631)
        self.assertEqual(feature["properties"]["license"], "ODbL")
        self.assertIn(feature["geometry"]["type"], {"Polygon", "MultiPolygon"})


if __name__ == "__main__":
    unittest.main()
