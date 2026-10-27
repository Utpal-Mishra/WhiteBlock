BEGIN;

-- Phase 1.5 separates "the parking asset exists" from "WHITEBLOCK may
-- recommend it" and from any future commercial/operator relationship.
ALTER TABLE parking_location
  ADD COLUMN IF NOT EXISTS physical_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS recommendation_status text NOT NULL DEFAULT 'unassessed',
  ADD COLUMN IF NOT EXISTS partnership_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS live_data_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS coverage_classes text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parking_location_physical_status'
  ) THEN
    ALTER TABLE parking_location
      ADD CONSTRAINT parking_location_physical_status
      CHECK (physical_status IN ('unknown','candidate','confirmed','removed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parking_location_recommendation_status'
  ) THEN
    ALTER TABLE parking_location
      ADD CONSTRAINT parking_location_recommendation_status
      CHECK (recommendation_status IN ('unassessed','eligible','conditional','ineligible'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parking_location_partnership_status'
  ) THEN
    ALTER TABLE parking_location
      ADD CONSTRAINT parking_location_partnership_status
      CHECK (partnership_status IN ('none','prospect','active','suspended','ended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parking_location_live_data_status'
  ) THEN
    ALTER TABLE parking_location
      ADD CONSTRAINT parking_location_live_data_status
      CHECK (live_data_status IN ('none','available','stale','unavailable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS parking_location_universe_state_idx
  ON parking_location (physical_status, recommendation_status, partnership_status);

-- Commercial integrations enrich an existing WB-PARK asset. They never create
-- or replace the canonical parking identity.
CREATE TABLE IF NOT EXISTS parking_partner_capability (
  parking_id text NOT NULL REFERENCES parking_location(parking_id) ON DELETE CASCADE,
  partner_key text NOT NULL,
  operator_name text,
  relationship_status text NOT NULL DEFAULT 'prospect',
  booking_supported boolean NOT NULL DEFAULT false,
  payment_supported boolean NOT NULL DEFAULT false,
  live_occupancy_supported boolean NOT NULL DEFAULT false,
  session_management_supported boolean NOT NULL DEFAULT false,
  partner_access_supported boolean NOT NULL DEFAULT false,
  booking_url text,
  payment_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parking_id, partner_key),
  CONSTRAINT parking_partner_capability_relationship_status
    CHECK (relationship_status IN ('prospect','active','suspended','ended'))
);

CREATE INDEX IF NOT EXISTS parking_partner_capability_partner_idx
  ON parking_partner_capability (partner_key, relationship_status);

DROP TRIGGER IF EXISTS parking_partner_capability_touch_updated_at ON parking_partner_capability;
CREATE TRIGGER parking_partner_capability_touch_updated_at
BEFORE UPDATE ON parking_partner_capability
FOR EACH ROW EXECUTE FUNCTION wb_touch_updated_at();

COMMIT;
