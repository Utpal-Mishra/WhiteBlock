import os
import pathlib
import sys
import unittest

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from db_common import connect  # noqa: E402


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL not configured")
class ParkingGuidanceIntegrationTests(unittest.TestCase):
    def test_guidance_display_reading_and_comparison_schema(self):
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO parking_location (
                      parking_id, name, geom, parking_type, access_type, lifecycle_status,
                      capacity_verified
                    ) VALUES (
                      'WB-PARK-GUIDANCE-TEST', 'Guidance Test Car Park',
                      ST_SetSRID(ST_MakePoint(-6.2603, 53.3498), 4326),
                      'multistorey', 'public', 'verified', 400
                    )
                    """
                )
                cur.execute(
                    """
                    INSERT INTO parking_observation (
                      parking_id, observed_at, retrieved_at, available_spaces,
                      capacity_at_observation, source_key, truth_state, confidence
                    ) VALUES (
                      'WB-PARK-GUIDANCE-TEST', '2026-09-15T20:00:00Z', now(), 112,
                      400, 'guidance_test_system', 'observed', 0.99
                    ) RETURNING observation_id
                    """
                )
                observation_id = cur.fetchone()[0]

                cur.execute(
                    """
                    INSERT INTO parking_guidance_display (
                      display_id, source_key, external_id, name, geom,
                      operator_name, sign_type, lifecycle_status
                    ) VALUES (
                      'WB-VMS-GUIDANCE-TEST', 'guidance_test_registry', 'VMS-T1',
                      'Guidance Test Sign', ST_SetSRID(ST_MakePoint(-6.261, 53.35), 4326),
                      'Test Authority', 'vms', 'verified'
                    )
                    """
                )
                cur.execute(
                    """
                    INSERT INTO parking_guidance_reading (
                      display_id, observed_at, target_key, parking_id, target_label,
                      displayed_available_spaces, source_key, source_type, truth_state, confidence
                    ) VALUES (
                      'WB-VMS-GUIDANCE-TEST', '2026-09-15T20:00:30Z', 'test-target',
                      'WB-PARK-GUIDANCE-TEST', 'Guidance Test Car Park', 110,
                      'guidance_test_display', 'manual', 'observed', 0.95
                    ) RETURNING reading_id
                    """
                )
                reading_id = cur.fetchone()[0]

                cur.execute(
                    """
                    INSERT INTO parking_guidance_comparison (
                      display_reading_id, parking_observation_id, variance_spaces,
                      source_lag_seconds, agreement_score
                    ) VALUES (%s, %s, -2, 30, 0.995)
                    """,
                    (reading_id, observation_id),
                )

                cur.execute(
                    """
                    SELECT displayed_available_spaces, parking_id, age_seconds
                    FROM parking_guidance_health
                    WHERE display_id = 'WB-VMS-GUIDANCE-TEST'
                    """
                )
                health = cur.fetchone()
                self.assertEqual(health[0], 110)
                self.assertEqual(health[1], "WB-PARK-GUIDANCE-TEST")
                self.assertIsNotNone(health[2])

                cur.execute(
                    "SELECT variance_spaces, source_lag_seconds, agreement_score FROM parking_guidance_comparison WHERE display_reading_id = %s",
                    (reading_id,),
                )
                comparison = cur.fetchone()
                self.assertEqual(comparison[0], -2)
                self.assertEqual(comparison[1], 30)
                self.assertAlmostEqual(float(comparison[2]), 0.995, places=3)
        finally:
            conn.rollback()
            conn.close()


if __name__ == "__main__":
    unittest.main()
