BEGIN;

CREATE TABLE IF NOT EXISTS parking_guidance_display (
  display_id text PRIMARY KEY,
  source_key text NOT NULL,
  external_id text,
  name text NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  road_name text,
  direction_of_travel text,
  operator_name text,
  sign_type text NOT NULL DEFAULT 'vms',
  lifecycle_status text NOT NULL DEFAULT 'verified',
  source_url text,
  source_timestamp timestamptz,
  retrieved_at timestamptz,
  last_verified_at timestamptz,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_guidance_display_status CHECK (lifecycle_status IN ('candidate','verified','published','retired')),
  CONSTRAINT parking_guidance_display_sign_type CHECK (sign_type IN ('vms','parking_guidance','digital_display','other')),
  UNIQUE (source_key, external_id)
);

CREATE INDEX IF NOT EXISTS parking_guidance_display_geom_gix
  ON parking_guidance_display USING gist (geom);
CREATE INDEX IF NOT EXISTS parking_guidance_display_source_idx
  ON parking_guidance_display (source_key, lifecycle_status);

DROP TRIGGER IF EXISTS parking_guidance_display_touch_updated_at ON parking_guidance_display;
CREATE TRIGGER parking_guidance_display_touch_updated_at
BEFORE UPDATE ON parking_guidance_display
FOR EACH ROW EXECUTE FUNCTION wb_touch_updated_at();

CREATE TABLE IF NOT EXISTS parking_guidance_display_target (
  display_id text NOT NULL REFERENCES parking_guidance_display(display_id) ON DELETE CASCADE,
  target_key text NOT NULL,
  parking_id text REFERENCES parking_location(parking_id) ON DELETE SET NULL,
  target_label text NOT NULL,
  target_order integer,
  direction_hint text,
  confidence numeric(5,4),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (display_id, target_key),
  CONSTRAINT parking_guidance_target_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX IF NOT EXISTS parking_guidance_target_parking_idx
  ON parking_guidance_display_target (parking_id);

DROP TRIGGER IF EXISTS parking_guidance_target_touch_updated_at ON parking_guidance_display_target;
CREATE TRIGGER parking_guidance_target_touch_updated_at
BEFORE UPDATE ON parking_guidance_display_target
FOR EACH ROW EXECUTE FUNCTION wb_touch_updated_at();

CREATE TABLE IF NOT EXISTS parking_guidance_reading (
  reading_id bigserial PRIMARY KEY,
  display_id text NOT NULL REFERENCES parking_guidance_display(display_id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  target_key text,
  parking_id text REFERENCES parking_location(parking_id) ON DELETE SET NULL,
  target_label text,
  displayed_available_spaces integer,
  displayed_message text,
  source_key text NOT NULL,
  source_type text NOT NULL DEFAULT 'system_feed',
  truth_state text NOT NULL DEFAULT 'observed',
  confidence numeric(5,4),
  raw_snapshot_ref text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_guidance_reading_spaces_nonnegative CHECK (displayed_available_spaces IS NULL OR displayed_available_spaces >= 0),
  CONSTRAINT parking_guidance_reading_source_type CHECK (source_type IN ('system_feed','operator_feed','camera','ocr','manual','unknown')),
  CONSTRAINT parking_guidance_reading_truth CHECK (truth_state IN ('observed','inferred','predicted','unverified')),
  CONSTRAINT parking_guidance_reading_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  UNIQUE (display_id, observed_at, source_key, target_key)
);

CREATE INDEX IF NOT EXISTS parking_guidance_reading_time_idx
  ON parking_guidance_reading (display_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS parking_guidance_reading_parking_idx
  ON parking_guidance_reading (parking_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS parking_guidance_comparison (
  comparison_id bigserial PRIMARY KEY,
  display_reading_id bigint NOT NULL REFERENCES parking_guidance_reading(reading_id) ON DELETE CASCADE,
  parking_observation_id bigint NOT NULL REFERENCES parking_observation(observation_id) ON DELETE CASCADE,
  compared_at timestamptz NOT NULL DEFAULT now(),
  variance_spaces integer,
  source_lag_seconds integer,
  agreement_score numeric(5,4),
  notes text,
  CONSTRAINT parking_guidance_comparison_agreement CHECK (agreement_score IS NULL OR (agreement_score >= 0 AND agreement_score <= 1)),
  UNIQUE (display_reading_id, parking_observation_id)
);

CREATE INDEX IF NOT EXISTS parking_guidance_comparison_time_idx
  ON parking_guidance_comparison (compared_at DESC);

CREATE OR REPLACE VIEW latest_parking_guidance_reading AS
SELECT DISTINCT ON (display_id, coalesce(target_key, ''))
  reading_id,
  display_id,
  observed_at,
  retrieved_at,
  target_key,
  parking_id,
  target_label,
  displayed_available_spaces,
  displayed_message,
  source_key,
  source_type,
  truth_state,
  confidence,
  attributes
FROM parking_guidance_reading
ORDER BY display_id, coalesce(target_key, ''), observed_at DESC, reading_id DESC;

CREATE OR REPLACE VIEW parking_guidance_health AS
SELECT
  d.display_id,
  d.name,
  d.source_key,
  d.lifecycle_status,
  r.observed_at,
  r.retrieved_at,
  r.displayed_available_spaces,
  r.displayed_message,
  r.parking_id,
  r.confidence,
  CASE
    WHEN r.observed_at IS NULL THEN NULL
    ELSE greatest(0, extract(epoch FROM (now() - r.observed_at)))::bigint
  END AS age_seconds
FROM parking_guidance_display d
LEFT JOIN latest_parking_guidance_reading r ON r.display_id = d.display_id;

COMMIT;
