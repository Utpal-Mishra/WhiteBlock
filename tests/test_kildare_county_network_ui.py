from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class KildareCountyNetworkUiTests(unittest.TestCase):
    def test_region_network_uses_exact_county_snapshot_contract(self):
        source = (WEB / "region-network.js").read_text(encoding="utf-8")
        self.assertIn("WB_KILDARE_BOUNDARY_RELATION_ID = 285833", source)
        self.assertIn('snapshot?.coverage?.scope !== "county_wide_network"', source)
        self.assertIn("mapped_polygon_locations", source)
        self.assertIn("geometry: record.geometry || null", source)
        self.assertIn("complete county inventory", source)

    def test_region_network_exposes_wider_county_hubs(self):
        source = (WEB / "region-network.js").read_text(encoding="utf-8")
        for town in [
            "Monasterevin",
            "Rathangan",
            "Prosperous",
            "Castledermot",
            "Allenwood",
            "Robertstown",
            "Ballymore Eustace",
            "Ballitore",
        ]:
            self.assertIn(f'\"{town}\"', source)

    def test_region_network_does_not_claim_live_kildare_occupancy(self):
        source = (WEB / "region-network.js").read_text(encoding="utf-8")
        self.assertIn("no live occupancy feed connected for Kildare", source)
        self.assertIn("available: null", source)

    def test_region_network_javascript_syntax(self):
        result = subprocess.run(
            ["node", "--check", str(WEB / "region-network.js")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
