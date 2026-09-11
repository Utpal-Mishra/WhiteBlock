# Spatial Storage & Entity Reconciliation

## Purpose

This layer turns WHITEBLOCK from a file-based pilot into a persistent spatial system of record.

It deliberately separates:

1. **canonical parking locations** — WHITEBLOCK's durable representation of a parking asset;
2. **parking observations** — time-varying availability/occupancy;
3. **source records** — records received from external datasets before trust or identity is resolved;
4. **source links** — durable mappings between external identifiers and WHITEBLOCK assets;
5. **evidence** — provenance supporting a location or field;
6. **match candidates** — reviewable reconciliation hypotheses;
7. **parking candidates** — unverified physical/spatial opportunities discovered later from imagery, GIS or other evidence.

No external record becomes a canonical public parking asset merely because it is spatially close to an existing point.

## Technology choice

The pilot uses PostgreSQL + PostGIS because WHITEBLOCK needs native support for:

- points and polygons;
- spatial indexes;
- distance queries;
- polygon overlap;
- later route/network integration;
- geospatial analytics;
- reliable relational constraints and auditability.

`pg_trgm` is enabled for fuzzy parking-name comparison.

## Local setup

Copy the environment template and change the password:

```bash
cp .env.example .env
```

Export `DATABASE_URL` from that configuration, then install the Python dependency:

```bash
make install
```

Start PostGIS:

```bash
make db-up
```

The initial migration in `db/migrations/001_spatial_core.sql` runs automatically when the Docker database volume is first created.

If the development schema changes while the database already exists, recreate the local volume:

```bash
make db-reset
```

This destroys local development database data and must not be used against production storage.

## Cork baseline flow

```text
Cork City Council feed
        ↓
python scripts/ingest_cork_parking.py
        ↓
data/cork/curated/
        ↓
python scripts/load_cork_to_postgis.py
        ↓
parking_location
parking_observation
parking_evidence
parking_source_link
source_record
```

Commands:

```bash
make ingest
make load
```

The authoritative Cork identifier is linked with match score `1.0` using `exact_authoritative_id`. The loader does not fuzzy-match the source that created the original canonical Cork baseline.

## Canonical spatial tables

### `parking_location`

Durable WHITEBLOCK parking assets.

Important properties:

- `parking_id` is the WHITEBLOCK identifier;
- `geom` is a WGS84 point (`EPSG:4326`);
- optional `footprint` and `entrance_geom` allow richer geometry later;
- current availability never lives here;
- asset status and access classification are constrained values;
- spatial and trigram indexes support reconciliation.

### `parking_observation`

Historical state for forecasting and live display.

Uniqueness is enforced for:

```text
parking_id + observed_at + source_key
```

This makes reloading the same observation idempotent.

### `parking_evidence`

Links source evidence to canonical assets while preserving:

- source;
- timestamp;
- truth state;
- confidence;
- staging record;
- field context where applicable.

### `source_record`

The quarantine/staging boundary for secondary datasets.

A secondary source can be imported without changing the canonical inventory. New records begin as `pending` and move to `linked`, `review`, or `rejected` after reconciliation.

### `parking_source_link`

Durable mapping:

```text
(source_key, external_id) → parking_id
```

Once an external ID is reliably linked, future records from that source use this exact identity before any fuzzy matching.

### `entity_match_candidate`

Stores proposed source-to-canonical matches and their evidence. It is intentionally inspectable rather than hiding matching decisions inside application code.

### `parking_candidate`

Reserved for future imagery/GIS/geolocation discoveries. These are potential parking assets, not verified user-facing parking.

## Staging a secondary source

WHITEBLOCK uses a small normalized interchange contract for secondary sources.

Required fields:

```json
{
  "external_id": "source-123",
  "name": "Example Car Park",
  "latitude": 51.8985,
  "longitude": -8.4756
}
```

Optional fields:

```text
capacity
access_hint
source_timestamp
retrieved_at
raw_snapshot_ref
payload
```

Stage JSON/JSONL records using:

```bash
python scripts/stage_source_records.py \
  --source-key osm_parking \
  --input data/osm_parking.jsonl
```

The staging tool validates coordinates and basic capacity values but does **not** treat the source as canonical truth.

## Reconciliation policy

Run:

```bash
python scripts/reconcile_source_records.py --source-key osm_parking
```

Candidate canonical assets are searched within a configurable radius (default `150 m`). Each candidate receives evidence from:

- normalized name similarity;
- geographic distance;
- capacity similarity when both sources contain capacity.

Initial scoring weights:

```text
name similarity       60%
spatial proximity     35%
capacity similarity    5%
```

If capacity is missing, its weight is omitted rather than treating missing data as disagreement.

## Conservative auto-link gate

A fuzzy candidate is automatically linked only when all initial conditions hold:

```text
match score        >= 0.92
name similarity    >= 0.88
distance           <= 30 m
best-vs-second gap >= 0.08
```

These are pilot thresholds, not universal truths. They must be calibrated against manually labelled Cork matches before production use.

The margin requirement matters. Two nearby similarly named car parks should remain unresolved even when both appear individually plausible.

## Manual review

Ambiguous records remain `review`.

A candidate can be confirmed with:

```bash
python scripts/resolve_entity_match.py confirm \
  --staging-id 123 \
  --parking-id WB-PARK-IE-CORK-000012
```

or rejected with:

```bash
python scripts/resolve_entity_match.py reject \
  --staging-id 123 \
  --parking-id WB-PARK-IE-CORK-000012
```

Confirmation creates a durable source link and evidence entry. Rejection does not automatically create a new asset.

That is intentional: an unmatched source record could be a genuinely new car park, a private facility, bad coordinates, stale data, or a duplicate represented differently.

## Source-of-truth hierarchy

Entity identity and field truth are separate questions.

Two records can refer to the same physical car park while disagreeing on capacity, access or price. Reconciliation answers **"is this the same place?"**; field-level evidence rules answer **"which value should WHITEBLOCK trust?"**.

Initial source priority remains:

1. authoritative/local-authority or operator source;
2. verified government geospatial source;
3. appropriately licensed commercial source;
4. open/community source;
5. aggregated consented observations;
6. model inference.

A lower-priority source should not overwrite a high-confidence authoritative field simply because entity matching succeeded.

## Useful review queries

Pending/review records:

```sql
SELECT staging_id, source_key, external_id, name, reconciliation_status
FROM source_record
WHERE reconciliation_status = 'review'
ORDER BY staging_id;
```

Highest-scoring unresolved matches:

```sql
SELECT
  m.staging_id,
  s.source_key,
  s.name AS source_name,
  m.parking_id,
  p.name AS canonical_name,
  m.distance_m,
  m.name_similarity,
  m.match_score,
  m.decision
FROM entity_match_candidate m
JOIN source_record s USING (staging_id)
JOIN parking_location p USING (parking_id)
WHERE m.decision = 'review'
ORDER BY m.match_score DESC;
```

Latest availability:

```sql
SELECT p.parking_id, p.name, o.available_spaces, o.occupancy_ratio, o.observed_at
FROM parking_location p
LEFT JOIN latest_parking_observation o USING (parking_id)
WHERE p.lifecycle_status IN ('verified', 'published');
```

## Quality metrics to add to the Cork pilot

Track reconciliation independently from parking-discovery accuracy:

- exact-link coverage;
- auto-link precision;
- manual-review rate;
- false-merge rate;
- false-non-match rate;
- unmatched-source rate;
- median spatial disagreement between linked sources;
- field-conflict rate after identity reconciliation.

For WHITEBLOCK, **false merges are more damaging than false non-matches**. One incorrect merge can contaminate rules, capacity, availability and future model training for the wrong physical location.

## Tests

Run all current tests:

```bash
make test
```

`tests/test_reconciliation.py` validates the core scoring and conservative decision policy without requiring a database. Database integration tests should be added once CI provisions PostGIS.

## Next implementation boundary

With this layer in place, the next source integration should be a secondary geospatial parking inventory such as OpenStreetMap or another properly licensed source. Its records should be staged first, reconciled against the Cork canonical baseline, and manually evaluated to measure matching precision before imagery-derived candidates are introduced.
