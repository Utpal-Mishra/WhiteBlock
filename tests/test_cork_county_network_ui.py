from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class CorkCountyNetworkUiTests(unittest.TestCase):
    def test_runtime_loads_county_adapter_before_region_network(self):
        source = (WEB / "runtime-config.js").read_text(encoding="utf-8")
        county_pos = source.index("cork-county-network.js")
        region_pos = source.index("region-network.js")
        self.assertLess(county_pos, region_pos)
        self.assertIn("loadWhiteblockCorkCountyNetwork", source)

    def test_county_adapter_exposes_major_hubs_and_snapshot(self):
        source = (WEB / "cork-county-network.js").read_text(encoding="utf-8")
        self.assertIn("cork_county_parking_snapshot.json", source)
        for town in ["Mallow", "Midleton", "Cobh", "Bandon", "Clonakilty", "Bantry", "Youghal", "Castletownbere"]:
            self.assertIn(f'\"{town}\"', source)
        self.assertIn("cityPilotCheck", source)
        self.assertIn("county-wide live occupancy not connected", source)
        self.assertIn("state.regionInventories.corkCounty", source)

    def test_county_adapter_does_not_fabricate_availability(self):
        source = (WEB / "cork-county-network.js").read_text(encoding="utf-8")
        self.assertIn("available: null", source)
        self.assertIn("Mapped County Cork parking inventory", source)

    def test_county_adapter_javascript_syntax(self):
        result = subprocess.run(
            ["node", "--check", str(WEB / "cork-county-network.js")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
