BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS parking_evidence_dedup_idx
ON parking_evidence (
  coalesce(parking_id, ''),
  coalesce(staging_id, 0),
  coalesce(field_name, ''),
  source_type,
  source_key,
  coalesce(source_timestamp, 'epoch'::timestamptz),
  coalesce(retrieved_at, 'epoch'::timestamptz),
  truth_state,
  coalesce(confidence, -1),
  md5(evidence_payload::text)
);

COMMIT;
