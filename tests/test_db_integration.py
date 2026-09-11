import json
import os
import pathlib
import sys
import unittest

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from db_common import connect  # noqa: E402
from reconcile_source_records import reconcile_one  # noqa: E402


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL not configured")
class PostGISIntegrationTests(unittest.TestCase):
    def test_staged_record_auto_links_to_clear_canonical_match(self):
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO parking_location (
                      parking_id, name, geom, parking_type, access_type, lifecycle_status,
                      capacity_verified
                    ) VALUES (
                      'WB-PARK-TEST-000001', 'Integration Test Car Park',
                      ST_SetSRID(ST_MakePoint(-8.4756, 51.8985), 4326),
                      'surface', 'public', 'verified', 100
                    )
                    """
                )
                cur.execute(
                    """
                    INSERT INTO source_record (
                      source_key, external_id, retrieved_at, name, geom, capacity,
                      payload, content_hash, reconciliation_status
                    ) VALUES (
                      'integration_test_source', 'source-1', now(), 'Integration Test Car Park',
                      ST_SetSRID(ST_MakePoint(-8.4756, 51.8985), 4326), 100,
                      %s::jsonb, 'integration-test-hash', 'pending'
                    ) RETURNING staging_id, source_timestamp, retrieved_at
                    """,
                    (json.dumps({"test": True}),),
                )
                staging_id, source_timestamp, retrieved_at = cur.fetchone()
                outcome, parking_id = reconcile_one(
                    cur,
                    {
                        "staging_id": staging_id,
                        "source_key": "integration_test_source",
                        "external_id": "source-1",
                        "source_timestamp": source_timestamp,
                        "retrieved_at": retrieved_at,
                        "name": "Integration Test Car Park",
                        "capacity": 100,
                    },
                    150.0,
                )
                self.assertEqual(outcome, "auto_linked")
                self.assertEqual(parking_id, "WB-PARK-TEST-000001")

                cur.execute(
                    """
                    SELECT parking_id, match_method
                    FROM parking_source_link
                    WHERE source_key = 'integration_test_source' AND external_id = 'source-1'
                    """
                )
                linked = cur.fetchone()
                self.assertEqual(linked[0], "WB-PARK-TEST-000001")
                self.assertEqual(linked[1], "spatial_name_reconciliation")
        finally:
            conn.rollback()
            conn.close()


if __name__ == "__main__":
    unittest.main()
