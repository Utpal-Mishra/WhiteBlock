# WHITEBLOCK Web UI

Responsive static prototype for the WHITEBLOCK driver and intelligence experience.

## Run locally

```bash
python -m http.server 8000 -d web
```

Open `http://localhost:8000`.

## Current views

- **Find** — destination-first parking recommendation.
- **Discover** — candidate supply and change detection.
- **Network** — supply adequacy and redistribution strategy.
- **Evidence** — truth state, confidence and freshness.

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

Searching a destination outside the Cork pilot never reuses the Cork parking cards as if they were local. Instead the UI confirms the destination and explicitly states that the regional parking layer is not connected yet.

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

## Map context layers

The map supports:

- WHITEBLOCK dark street context;
- full-colour street context;
- satellite context;
- Street View handoff for the selected destination/parking location;
- availability halos for good/moderate/pressure states;
- a 500 m destination-context radius;
- mobile resize/orientation repair.

## Parking Guidance Intelligence

The map now loads a **Guidance** layer using the official Dublin City Council Variable Message Sign location registry.

The source currently provides **display locations only**. It does not provide the live number/message shown on the sign. The UI explicitly states this in each sign popup.

When available, the control shows the number of official sign locations loaded, for example:

```text
Guidance · 31
```

Selecting a guidance marker shows:

- sign/location identity;
- source status;
- the fact that the live display value is not exposed by that source;
- a link to the official dataset.

If the remote registry cannot be loaded, WHITEBLOCK reports `Guidance · source unavailable` rather than substituting invented display locations.

Future direct/operator/OCR/manual readings belong in the PostGIS Parking Guidance Intelligence layer and remain separate from canonical parking-system observations.

See `docs/PARKING_GUIDANCE_INTELLIGENCE.md`.

## Data status

The current Cork parking interface uses explicitly labelled demo values. Production integration should replace `parkingData` in `app.js` with a read-only WHITEBLOCK API backed by the PostGIS spatial core.

The Dublin VMS marker layer is based on the official open location registry, but its displayed parking counts/messages are **not** live because that registry does not expose them.

## Mapping

The prototype uses Leaflet with keyless Esri street/satellite basemaps and external public geocoding/data sources. Production map-provider, caching, attribution, geocoding, CORS, SLA and usage-policy requirements should be reviewed before commercial deployment.
