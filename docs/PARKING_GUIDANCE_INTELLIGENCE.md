# WHITEBLOCK Parking Guidance Intelligence

## Purpose

Roadside digital parking signs and Variable Message Signs (VMS) can provide an additional observation channel for parking availability and traffic guidance.

WHITEBLOCK does **not** treat the sign as the canonical parking source. The sign usually reflects a backend parking-management feed, sometimes with its own update latency. The platform therefore keeps three things separate:

1. the parking-system observation;
2. the value/message shown on the roadside display;
3. the predicted value at the driver's expected arrival time.

This makes it possible to measure freshness, disagreement and reliability instead of silently replacing one value with another.

## Architecture

```text
Parking sensor / counter
        ↓
Council or operator system
        ├──────────────→ parking_observation
        │
        └────→ roadside guidance / VMS
                       ↓
             parking_guidance_reading
                       ↓
           parking_guidance_comparison
                       ↓
              WHITEBLOCK evidence
                       ↓
             ETA prediction / ranking
```

## Core entities

### `parking_guidance_display`

A durable physical roadside-display asset.

Key fields:

- `display_id`
- source/external id
- name/location
- geometry
- road/direction of travel
- operator
- sign type
- lifecycle state
- provenance and source metadata

### `parking_guidance_display_target`

Maps a sign to one or more parking facilities/messages it references.

The mapping can be incomplete. A sign location does not prove which car parks it currently displays.

### `parking_guidance_reading`

A time-stamped observation of what a display showed.

Possible sources:

- direct system feed;
- operator feed;
- permitted camera observation;
- OCR from permitted imagery;
- manual field verification.

The record can contain:

- displayed available spaces;
- text message;
- referenced parking location;
- observation time;
- source type;
- confidence;
- raw evidence reference.

### `parking_guidance_comparison`

Links a sign reading to a parking-system observation and stores:

- space-count variance;
- time lag;
- agreement score;
- comparison notes.

This lets WHITEBLOCK learn how trustworthy/fresh each display channel is.

## Current verified sources

### Dublin City Council VMS locations

Official Dublin City Council open data lists **31 Variable Message Sign locations** with equipment ID, location name and coordinates.

The dataset is a location registry only. It does **not** expose the live text or parking count currently displayed on each sign.

Registered source:

```text
dublin_vms_locations
```

WHITEBLOCK can ingest it with:

```bash
python scripts/ingest_dublin_vms.py
```

or validate a downloaded copy without writing to PostGIS:

```bash
python scripts/ingest_dublin_vms.py --input dcc_variable_message_signs_4326.geojson --dry-run
```

### Dublin multistorey parking availability

Dublin City Council also publishes its multistorey parking availability service, described as updating roughly every five minutes. This is the system-side parking observation source to reconcile against display readings where a mapping/feed is available.

### Cork parking availability

The existing Cork City Council ingestion already supplies total spaces, free spaces, coordinates and timestamps. It is therefore ready to be used as the system-side observation source if an official Cork roadside-display registry or value feed is identified later.

No unverified Cork VMS locations are created in the current implementation.

## Map behaviour

The web prototype adds a **Guidance** control to the existing map toolbar.

For Dublin it attempts to load the official VMS location GeoJSON directly. Each sign marker clearly states:

> Official location · live display value not exposed by this source

This distinction is intentional. WHITEBLOCK should never imply that a sign count is live unless a reading source actually exists.

If the remote registry cannot be reached from the browser, the guidance layer reports the source as unavailable instead of falling back to invented sign locations.

## Recording a display observation

A permitted/manual observation can be captured with:

```bash
python scripts/record_guidance_reading.py \
  --display-id WB-VMS-IE-DUB-VMS-101 \
  --observed-at 2026-09-15T20:00:00Z \
  --available 110 \
  --parking-id WB-PARK-IE-DUB-000001 \
  --target-key carpark-1 \
  --target-label "Example Car Park" \
  --source-key field_observation \
  --source-type manual \
  --confidence 0.95
```

If a linked parking observation exists within ±15 minutes, WHITEBLOCK automatically stores a comparison.

Example conceptual result:

```text
Roadside display         110 spaces
Parking-system feed      112 spaces
Variance                  -2 spaces
Source lag                45 seconds
Agreement                 99.5%
```

## OCR policy

OCR should be a fallback, not the preferred feed.

A camera/OCR reading must have:

- lawful/authorised imagery access;
- source timestamp;
- display identity/location;
- OCR confidence;
- original evidence reference;
- truth state `inferred` unless independently verified.

OCR output must never overwrite an official system observation.

## Reliability metrics to add later

Per display/source pair:

- median update lag;
- mean absolute space-count difference;
- percentage of readings within ±1, ±5 and ±10 spaces;
- stale-reading rate;
- missing-reading rate;
- sign/system agreement by time of day;
- confidence calibration for OCR observations.

These metrics can become part of the WHITEBLOCK evidence score used by recommendations.

## Next integration steps

1. Ingest the Dublin VMS registry into PostGIS.
2. Reconcile/match VMS targets to canonical Dublin parking assets when Dublin inventory is added.
3. Connect the official Dublin multistorey availability feed.
4. Identify whether a direct VMS message/value feed is available from Dublin City Council/operator systems.
5. Run a small field-validation sample to measure sign/feed latency.
6. Add guidance reliability to the Evidence and Network views.
7. Repeat the pattern in Cork only after a verified VMS source is found.
