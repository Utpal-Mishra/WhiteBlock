BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION wb_normalize_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE TABLE IF NOT EXISTS parking_location (
  parking_id text PRIMARY KEY,
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (wb_normalize_name(name)) STORED,
  geom geometry(Point, 4326) NOT NULL,
  footprint geometry(Geometry, 4326),
  entrance_geom geometry(Geometry, 4326),
  parking_type text NOT NULL DEFAULT 'unknown',
  access_type text NOT NULL DEFAULT 'unknown',
  lifecycle_status text NOT NULL DEFAULT 'candidate',
  operator_name text,
  capacity_verified integer,
  capacity_estimated integer,
  accessible_spaces integer,
  ev_spaces integer,
  opening_hours_raw text,
  height_restriction_raw text,
  pricing_raw text,
  maximum_stay_minutes integer,
  source_notes text,
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_location_capacity_verified_nonnegative CHECK (capacity_verified IS NULL OR capacity_verified >= 0),
  CONSTRAINT parking_location_capacity_estimated_nonnegative CHECK (capacity_estimated IS NULL OR capacity_estimated >= 0),
  CONSTRAINT parking_location_access_type CHECK (access_type IN ('public','private','permit','customer','restricted','unknown')),
  CONSTRAINT parking_location_lifecycle CHECK (lifecycle_status IN ('candidate','verified','published','retired'))
);

CREATE INDEX IF NOT EXISTS parking_location_geom_gix ON parking_location USING gist (geom);
CREATE INDEX IF NOT EXISTS parking_location_footprint_gix ON parking_location USING gist (footprint);
CREATE INDEX IF NOT EXISTS parking_location_name_trgm_idx ON parking_location USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS parking_location_status_idx ON parking_location (lifecycle_status, access_type);

CREATE TABLE IF NOT EXISTS source_record (
  staging_id bigserial PRIMARY KEY,
  source_key text NOT NULL,
  external_id text,
  source_timestamp timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  name text,
  normalized_name text GENERATED ALWAYS AS (wb_normalize_name(name)) STORED,
  geom geometry(Point, 4326),
  footprint geometry(Geometry, 4326),
  capacity integer,
  access_hint text,
  payload jsonb NOT NULL,
  raw_snapshot_ref text,
  content_hash text,
  reconciliation_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_record_capacity_nonnegative CHECK (capacity IS NULL OR capacity >= 0),
  CONSTRAINT source_record_reconciliation_status CHECK (reconciliation_status IN ('pending','linked','review','rejected'))
);

CREATE INDEX IF NOT EXISTS source_record_geom_gix ON source_record USING gist (geom);
CREATE INDEX IF NOT EXISTS source_record_name_trgm_idx ON source_record USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS source_record_pending_idx ON source_record (source_key, reconciliation_status);
CREATE UNIQUE INDEX IF NOT EXISTS source_record_dedup_idx
  ON source_record (source_key, coalesce(external_id, ''), coalesce(content_hash, ''), retrieved_at);

CREATE TABLE IF NOT EXISTS parking_source_link (
  source_key text NOT NULL,
  external_id text NOT NULL,
  parking_id text NOT NULL REFERENCES parking_location(parking_id) ON DELETE CASCADE,
  match_method text NOT NULL,
  match_score numeric(5,4),
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source_key, external_id),
  CONSTRAINT parking_source_link_score CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 1))
);

CREATE INDEX IF NOT EXISTS parking_source_link_parking_idx ON parking_source_link (parking_id);

CREATE TABLE IF NOT EXISTS parking_observation (
  observation_id bigserial PRIMARY KEY,
  parking_id text NOT NULL REFERENCES parking_location(parking_id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL,
  available_spaces integer,
  occupied_spaces integer,
  capacity_at_observation integer,
  occupancy_ratio numeric(8,6),
  source_key text NOT NULL,
  source_record_id text,
  truth_state text NOT NULL DEFAULT 'observed',
  confidence numeric(5,4),
  model_version text,
  raw_snapshot_ref text,
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_observation_spaces_nonnegative CHECK (
    (available_spaces IS NULL OR available_spaces >= 0) AND
    (occupied_spaces IS NULL OR occupied_spaces >= 0) AND
    (capacity_at_observation IS NULL OR capacity_at_observation >= 0)
  ),
  CONSTRAINT parking_observation_ratio CHECK (occupancy_ratio IS NULL OR (occupancy_ratio >= 0 AND occupancy_ratio <= 1)),
  CONSTRAINT parking_observation_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT parking_observation_truth CHECK (truth_state IN ('observed','inferred','predicted','unverified')),
  UNIQUE (parking_id, observed_at, source_key)
);

CREATE INDEX IF NOT EXISTS parking_observation_time_idx ON parking_observation (parking_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS parking_observation_source_idx ON parking_observation (source_key, observed_at DESC);

CREATE TABLE IF NOT EXISTS parking_evidence (
  evidence_id bigserial PRIMARY KEY,
  parking_id text REFERENCES parking_location(parking_id) ON DELETE CASCADE,
  staging_id bigint REFERENCES source_record(staging_id) ON DELETE SET NULL,
  field_name text,
  source_type text NOT NULL,
  source_key text NOT NULL,
  source_url text,
  source_timestamp timestamptz,
  retrieved_at timestamptz,
  truth_state text NOT NULL,
  confidence numeric(5,4),
  evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_evidence_truth CHECK (truth_state IN ('observed','inferred','predicted','unverified')),
  CONSTRAINT parking_evidence_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX IF NOT EXISTS parking_evidence_parking_idx ON parking_evidence (parking_id, field_name);
CREATE INDEX IF NOT EXISTS parking_evidence_staging_idx ON parking_evidence (staging_id);

CREATE TABLE IF NOT EXISTS entity_match_candidate (
  staging_id bigint NOT NULL REFERENCES source_record(staging_id) ON DELETE CASCADE,
  parking_id text NOT NULL REFERENCES parking_location(parking_id) ON DELETE CASCADE,
  distance_m numeric(10,2),
  name_similarity numeric(6,5),
  capacity_similarity numeric(6,5),
  match_score numeric(6,5) NOT NULL,
  score_components jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text NOT NULL DEFAULT 'pending',
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  PRIMARY KEY (staging_id, parking_id),
  CONSTRAINT entity_match_score CHECK (match_score >= 0 AND match_score <= 1),
  CONSTRAINT entity_match_decision CHECK (decision IN ('pending','auto_linked','review','rejected','confirmed'))
);

CREATE INDEX IF NOT EXISTS entity_match_pending_idx ON entity_match_candidate (decision, match_score DESC);

CREATE TABLE IF NOT EXISTS parking_candidate (
  candidate_id text PRIMARY KEY,
  name text,
  geom geometry(Point, 4326) NOT NULL,
  footprint geometry(Geometry, 4326),
  candidate_type text NOT NULL DEFAULT 'unknown_parking',
  estimated_capacity integer,
  physical_confidence numeric(5,4),
  access_confidence numeric(5,4),
  status text NOT NULL DEFAULT 'detected',
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  promoted_parking_id text REFERENCES parking_location(parking_id),
  CONSTRAINT parking_candidate_status CHECK (status IN ('detected','candidate','physical_confirmed','access_classified','verified','rejected','promoted')),
  CONSTRAINT parking_candidate_capacity_nonnegative CHECK (estimated_capacity IS NULL OR estimated_capacity >= 0)
);

CREATE INDEX IF NOT EXISTS parking_candidate_geom_gix ON parking_candidate USING gist (geom);
CREATE INDEX IF NOT EXISTS parking_candidate_status_idx ON parking_candidate (status);

CREATE OR REPLACE FUNCTION wb_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parking_location_touch_updated_at ON parking_location;
CREATE TRIGGER parking_location_touch_updated_at
BEFORE UPDATE ON parking_location
FOR EACH ROW EXECUTE FUNCTION wb_touch_updated_at();

CREATE OR REPLACE VIEW latest_parking_observation AS
SELECT DISTINCT ON (parking_id)
  observation_id,
  parking_id,
  observed_at,
  retrieved_at,
  available_spaces,
  occupied_spaces,
  capacity_at_observation,
  occupancy_ratio,
  source_key,
  confidence,
  quality_flags
FROM parking_observation
ORDER BY parking_id, observed_at DESC, observation_id DESC;

COMMIT;
