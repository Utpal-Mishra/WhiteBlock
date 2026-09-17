BEGIN;

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
  quality_flags,
  truth_state
FROM parking_observation
ORDER BY parking_id, observed_at DESC, observation_id DESC;

COMMIT;
