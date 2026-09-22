import json
import shutil
import subprocess
import unittest
from pathlib import Path

from scripts import enrich_dublin_access_rules as rules


class DublinAccessRuleTests(unittest.TestCase):
    def test_customer_access_is_conditional_not_public(self):
        enriched = rules.enrich_location(
            {
                "parking_id": "WB-TEST-CUSTOMER",
                "access_type": "customers",
                "maximum_stay_minutes": 120,
                "opening_hours_raw": "Mo-Su 08:00-22:00",
                "pricing_raw": "No fee tagged in OpenStreetMap",
            }
        )
        self.assertEqual(enriched["access_type"], "customer")
        self.assertEqual(enriched["access_raw"], "customers")
        self.assertTrue(enriched["customer_only"])
        self.assertFalse(enriched["general_public_eligible"])
        self.assertEqual(enriched["maximum_stay_minutes"], 120)

    def test_customer_access_without_max_stay_does_not_invent_duration(self):
        enriched = rules.enrich_location(
            {
                "parking_id": "WB-TEST-CUSTOMER-NO-LIMIT",
                "access_type": "customers",
                "maximum_stay_minutes": None,
                "opening_hours_raw": None,
            }
        )
        self.assertEqual(enriched["access_type"], "customer")
        self.assertIsNone(enriched["maximum_stay_minutes"])
        self.assertEqual(enriched["maximum_stay_source_state"], "not_published")

    def test_unknown_access_remains_unknown(self):
        enriched = rules.enrich_location({"parking_id": "WB-TEST-UNKNOWN", "access_type": "unknown"})
        self.assertEqual(enriched["access_type"], "unknown")
        self.assertIsNone(enriched["general_public_eligible"])
        self.assertEqual(enriched["access_evidence_state"], "unknown")

    def test_explicit_yes_is_normalised_to_public(self):
        enriched = rules.enrich_location({"parking_id": "WB-TEST-PUBLIC", "access_type": "yes"})
        self.assertEqual(enriched["access_type"], "public")
        self.assertTrue(enriched["general_public_eligible"])

    def test_unrecognised_access_is_not_promoted_to_public(self):
        enriched = rules.enrich_location({"parking_id": "WB-TEST-PERMISSIVE", "access_type": "permissive"})
        self.assertEqual(enriched["access_type"], "permissive")
        self.assertIsNone(enriched["general_public_eligible"])

    def test_rule_audit_counts_customer_and_unknown_assets(self):
        snapshot = {
            "generated_at": "2026-09-22T00:00:00Z",
            "coverage": {
                "scope": "county_wide_network",
                "coverage_claim": "complete_boundary_traversal_not_complete_real_world_inventory",
            },
            "locations": [
                {"parking_id": "A", "local_authority": "Dublin City", "settlement": "Alpha", "access_type": "customers", "maximum_stay_minutes": 120},
                {"parking_id": "B", "local_authority": "Dublin City", "settlement": "Alpha", "access_type": "unknown"},
            ],
        }
        enriched, audit = rules.enrich_snapshot(snapshot)
        self.assertEqual(enriched["schema_version"], "1.3")
        self.assertEqual(audit["summary"]["customer_only_assets"], 1)
        self.assertEqual(audit["summary"]["unknown_access_assets"], 1)
        self.assertEqual(audit["summary"]["customer_assets_with_max_stay"], 1)

    def test_new_browser_files_parse_with_node_when_available(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        repo = Path(__file__).resolve().parents[1]
        for relative in ("web/dublin-restriction-integration.js", "web/runtime-config.js"):
            subprocess.run([node, "--check", str(repo / relative)], check=True, capture_output=True, text=True)


if __name__ == "__main__":
    unittest.main()
