from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone

import psycopg

from api.app import freshness_score, nearby_parking, parking_evidence


TEST_PARKING_ID = "WB-TEST-API-001"


class WhiteBlockApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise unittest.SkipTest("DATABASE_URL not configured")

        with psycopg.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM parking_evidence WHERE parking_id = %s", (TEST_PARKING_ID,))
                cursor.execute("DELETE FROM parking_observation WHERE parking_id = %s", (TEST_PARKING_ID,))
                cursor.execute("DELETE FROM parking_location WHERE parking_id = %s", (TEST_PARKING_ID,))
                cursor.execute(
                    """
                    INSERT INTO parking_location (
                      parking_id, name, geom, parking_type, access_type, lifecycle_status,
                      capacity_verified, opening_hours_raw, height_restriction_raw, pricing_raw,
                      last_verified_at
                    ) VALUES (
                      %s,
                      'WHITEBLOCK API Test Parking',
                      ST_SetSRID(ST_MakePoint(-8.4750, 51.8980), 4326),
                      'surface', 'public', 'verified',
                      100, '24/7', '2.0 m', '€2.50/hour', now()
                    )
                    """,
                    (TEST_PARKING_ID,),
                )
                cursor.execute(
                    """
                    INSERT INTO parking_observation (
                      parking_id, observed_at, retrieved_at, available_spaces,
                      occupied_spaces, capacity_at_observation, occupancy_ratio,
                      source_key, truth_state, confidence
                    ) VALUES (%s, now(), now(), 40, 60, 100, 0.6, 'test_api', 'observed', 0.98)
                    """,
                    (TEST_PARKING_ID,),
                )
                cursor.execute(
                    """
                    INSERT INTO parking_evidence (
                      parking_id, field_name, source_type, source_key, source_timestamp,
                      retrieved_at, truth_state, confidence, evidence_payload
                    ) VALUES (
                      %s, 'capacity_verified', 'official_dataset', 'test_api', now(), now(),
                      'observed', 0.95, '{"test": true}'::jsonb
                    )
                    """,
                    (TEST_PARKING_ID,),
                )
            connection.commit()

    @classmethod
    def tearDownClass(cls):
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            return
        with psycopg.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM parking_evidence WHERE parking_id = %s", (TEST_PARKING_ID,))
                cursor.execute("DELETE FROM parking_observation WHERE parking_id = %s", (TEST_PARKING_ID,))
                cursor.execute("DELETE FROM parking_location WHERE parking_id = %s", (TEST_PARKING_ID,))
            connection.commit()

    def test_freshness_score_is_high_for_current_observation(self):
        now = datetime.now(timezone.utc)
        self.assertEqual(freshness_score(now, now), 1.0)

    def test_nearby_endpoint_reads_postgis_and_derives_confidence(self):
        response = nearby_parking(
            lat=51.8985,
            lng=-8.4756,
            radius_km=2.0,
            limit=20,
            include_restricted=False,
        )
        record = next(item for item in response.locations if item.parking_id == TEST_PARKING_ID)
        self.assertLess(record.distance_m, 500)
        self.assertEqual(record.available_spaces, 40)
        self.assertEqual(record.capacity, 100)
        self.assertGreater(record.confidence.score, 0.90)
        self.assertEqual(record.truth_state, "observed")
        self.assertGreaterEqual(record.evidence_count, 1)

    def test_evidence_endpoint_returns_provenance(self):
        response = parking_evidence(TEST_PARKING_ID)
        self.assertGreaterEqual(response.count, 1)
        self.assertEqual(response.evidence[0].source_key, "test_api")
        self.assertEqual(response.evidence[0].truth_state, "observed")


if __name__ == "__main__":
    unittest.main()
