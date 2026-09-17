# WHITEBLOCK Web UI

Responsive static interface for the WHITEBLOCK driver and intelligence experience.

## Run locally

The deployed Pages build creates `web/data/parking_snapshot.json` before publishing. For a local data-backed preview, run:

```bash
python scripts/ingest_cork_parking.py --output-dir data/cork
python scripts/export_web_snapshot.py --input-dir data/cork --output web/data/parking_snapshot.json
python -m http.server 8000 -d web
```

Open `http://localhost:8000`.

## Current views

- **Find** — destination-first parking recommendation using the published Cork snapshot.
- **Discover** — candidate supply and change detection; still a research/prototype view.
- **Network** — supply adequacy and redistribution strategy; still a strategy/prototype view.
- **Evidence** — truth state, confidence and freshness; detailed live evidence wiring remains a later integration.

## Ireland map behaviour

The map has two different geographic responsibilities:

1. **Ireland destination layer** — the user can search for addresses, streets, landmarks, towns and other places across the Republic of Ireland and move the map to that destination.
2. **Parking intelligence layer** — evidence-backed parking recommendations remain Cork-first until equivalent local datasets are connected in other regions.

The **Ireland Coverage View** control zooms to the national extent and shows the current rollout model:

- Cork — pilot intelligence live;
- Dublin — next expansion;
- Galway — planned;
- Limerick — planned;
- Waterford — planned.

Searching a destination outside the Cork pilot never reuses Cork parking records as if they were local. The UI confirms the destination and explicitly states that the regional parking layer is not connected yet.

## Address suggestions

The destination input supports type-ahead suggestions.

The prototype queries the public Photon geocoder, using OpenStreetMap-derived place data, with:

- a Republic of Ireland geographic bounding box;
- result filtering to country code `IE`;
- debounced requests;
- cancellation of stale requests;
- keyboard navigation;
- a small local fallback list if the public geocoder is unavailable.

The public Photon endpoint is appropriate for prototype evaluation, not a guaranteed production dependency. Before commercial scale, WHITEBLOCK should use a managed geocoding service or a self-hosted geocoder with defined availability, quota, privacy and support requirements.

## Cork published-data bridge

GitHub Pages cannot connect directly to PostGIS, so WHITEBLOCK uses a deployment-time read model:

```text
Cork official feed
      ↓
scripts/ingest_cork_parking.py
      ↓
canonical inventory + latest observations
      ↓
scripts/export_web_snapshot.py
      ↓
web/data/parking_snapshot.json
      ↓
web/live-data.js
      ↓
destination-aware ranking + KPIs + map markers
```

The Pages workflow refreshes this snapshot every hour and on relevant pushes. Deployment is blocked if the ingestion fails or the exported snapshot contains zero locations. The previous deployed version therefore remains available instead of publishing a misleading empty/fake dataset.

The browser snapshot excludes raw source snapshots and internal evidence files. It contains only fields required by the public UI.

## Recommendation behaviour

For a Cork destination, `live-data.js`:

- calculates straight-line distance from the selected destination to each published parking asset;
- derives an approximate walking time using a documented route-factor assumption;
- limits normal recommendations to nearby assets;
- ranks by availability, distance, evidence confidence and price when a numeric tariff can be safely parsed;
- recomputes the result set when the destination or filter changes.

Walking time is an **estimate**, not route-engine output. A later production stage should use a routing service for road/walking-network travel times.

## Confidence

Confidence is no longer typed into the frontend. The public snapshot derives it from:

- source/provenance confidence;
- observation freshness;
- field completeness.

Assets from the same official feed can legitimately have similar confidence. Differences should come from evidence/freshness/completeness, not artificial variation.

## Map context layers

The map supports:

- full-colour Street view;
- Terrain view;
- Satellite context;
- Street View handoff for the selected destination/parking location;
- availability halos for good/moderate/pressure/unknown states;
- a destination-context radius;
- mobile resize/orientation repair.

## Parking Guidance Intelligence

The map also loads a **Guidance** layer using the official Dublin City Council Variable Message Sign location registry.

The source currently provides **display locations only**. It does not provide the live number/message shown on the sign. The UI explicitly states this in each sign popup.

When available, the control shows the number of official sign locations loaded. If the remote registry cannot be loaded, WHITEBLOCK reports the source as unavailable rather than substituting invented display locations.

Future direct/operator/OCR/manual readings belong in the PostGIS Parking Guidance Intelligence layer and remain separate from canonical parking-system observations.

See `docs/PARKING_GUIDANCE_INTELLIGENCE.md`.

## Data status

The **Find** experience now uses a published snapshot generated from the official Cork ingestion path. If that snapshot cannot be loaded, WHITEBLOCK shows a data-unavailable state and does **not** substitute the previous four demo car parks or hard-coded availability/confidence values.

The Discover, Network and detailed Evidence screens still contain prototype strategy content and should not yet be interpreted as live operational metrics.

## Mapping

The prototype uses Leaflet with public/keyless map layers and external public geocoding/data sources. Production map-provider, caching, attribution, geocoding, CORS, SLA and usage-policy requirements should be reviewed before commercial deployment.
