BEGIN;

DROP INDEX IF EXISTS source_record_dedup_idx;

CREATE UNIQUE INDEX source_record_dedup_idx
ON source_record (
  source_key,
  coalesce(external_id, ''),
  coalesce(content_hash, ''),
  coalesce(source_timestamp, 'epoch'::timestamptz)
);

COMMIT;
