# Cork Parking Ingestion Runbook

## Purpose

This runbook describes the first executable WHITEBLOCK data flow for the Cork pilot.

The implementation is intentionally simple and auditable: it uses the Python standard library, preserves the raw source payload, validates records, separates parking assets from live observations and quarantines inconsistent rows rather than silently repairing them.

## Command

From the repository root:

```bash
python scripts/ingest_cork_parking.py
```

Optional output location:

```bash
python scripts/ingest_cork_parking.py --output-dir data/cork
```

Run unit tests with:

```bash
python -m unittest tests/test_ingest_cork_parking.py
```

## Source

The default source is the Cork City Council Real Time Parking Spaces dataset configured in `config/cork_sources.yaml`.

Default endpoint:

```text
https://data.corkcity.ie/datastore/dump/f4677dac-bb30-412e-95a8-d3c22134e3c0
```

## Output structure

A successful run creates:

```text
data/cork/
├── raw/
│   └── cork_parking_<RUN_ID>.csv
├── curated/
│   ├── parking_inventory.json
│   ├── parking_observations.jsonl
│   └── quarantine.jsonl
├── manifests/
│   └── run_<RUN_ID>.json
└── latest_run.json
```

Generated data is intentionally excluded from Git through `.gitignore`.

## Processing contract

```text
OFFICIAL CORK FEED
       ↓
FETCH + SHA256
       ↓
RAW IMMUTABLE SNAPSHOT
       ↓
SOURCE SCHEMA CHECK
       ↓
ROW QUALITY CHECKS
       ↓
      / \
     /   \
 VALID   QUARANTINE
   ↓
SPLIT ASSET / OBSERVATION
   ↓                 ↓
INVENTORY        TIME SERIES
```

## Inventory output

`parking_inventory.json` contains relatively stable attributes such as:

- canonical WHITEBLOCK ID;
- source ID;
- name;
- coordinates;
- verified capacity;
- opening-hours text;
- height-restriction text;
- pricing text;
- provenance and confidence.

The live number of free spaces does **not** belong in this file.

## Observation output

`parking_observations.jsonl` stores the time-varying state:

- `parking_id`;
- `observed_at`;
- `retrieved_at`;
- `available_spaces`;
- `occupied_spaces` where derivable;
- capacity at the time of observation;
- occupancy ratio;
- truth state;
- source and raw-snapshot reference.

This becomes the historical basis for later availability forecasting.

## Quarantine rules

A source row is quarantined when the pilot detects conditions such as:

- invalid/missing coordinates;
- negative capacity;
- negative available spaces;
- available spaces greater than capacity;
- missing/invalid source timestamp;
- invalid source identifier;
- duplicate canonical parking ID in the same source payload.

Quarantine is preferred to silently modifying questionable authoritative data.

## Canonical ID rule

The Cork source publishes an integer identifier. During the pilot this maps deterministically to:

```text
WB-PARK-IE-CORK-{IDENTIFIER_PADDED_TO_6_DIGITS}
```

Example:

```text
identifier = 12
→ WB-PARK-IE-CORK-000012
```

This rule is valid only while the official identifier remains stable and unique. Before multi-source/city-scale production, WHITEBLOCK should move canonical identity into a persistent entity registry rather than assume every external identifier can be embedded in a master ID.

## Run manifest

Each run records:

- source URL/key;
- retrieval timestamp;
- raw snapshot path;
- SHA-256 hash;
- observed source columns;
- expected source columns;
- source, inventory, observation and quarantine counts;
- run status.

This provides the minimum evidence needed to reproduce or investigate an ingestion run.

## Operational checks after each run

Review:

1. source record count versus recent runs;
2. quarantine count;
3. missing/new source fields;
4. capacity changes;
5. asset additions/removals;
6. stale source timestamps;
7. unusual occupancy values.

Large changes should be treated as data-quality events until verified.

## Current limitations

The pilot script does not yet:

- persist data into PostGIS/another database;
- merge assets across multiple providers;
- execute OSM reconciliation;
- apply the pilot bounding box before output;
- parse tariffs/opening hours into structured rules;
- schedule itself;
- maintain append-only observation history across local runs beyond the emitted files;
- validate output against JSON Schema automatically;
- provide retries/alerting/monitoring.

These are intentional next-stage items rather than hidden assumptions.

## Next implementation increment

The next engineering layer should be **persistent spatial storage + entity reconciliation**:

```text
Cork feed
    +
OpenStreetMap
    ↓
source-specific staging
    ↓
entity reconciliation
    ↓
PostGIS canonical parking_location
    +
parking_observation history
    +
parking_evidence ledger
```

Only after that foundation is reliable should imagery-discovered candidates enter the same canonical workflow.
