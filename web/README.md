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

The map now has two different geographic responsibilities:

1. **Ireland destination layer** — the user can search for addresses, streets, landmarks, towns and other places across the Republic of Ireland and move the map to that destination.
2. **Parking intelligence layer** — evidence-backed parking recommendations remain Cork-first until equivalent local datasets are connected in other regions.

The `Ireland overview` control zooms to the national extent and shows the current rollout model:

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

## Data status

The current parking interface uses explicitly labelled demo values. Production integration should replace `parkingData` in `app.js` with a read-only WHITEBLOCK API backed by the PostGIS spatial core.

## Mapping

The prototype uses Leaflet with a dark CARTO/OpenStreetMap basemap. Production map-provider, caching, attribution, geocoding and usage-policy requirements should be reviewed before commercial deployment.
