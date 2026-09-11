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

## Data status

The current interface uses explicitly labelled demo values. Production integration should replace `parkingData` in `app.js` with a read-only WHITEBLOCK API backed by the PostGIS spatial core.

## Mapping

The prototype uses Leaflet with a dark CARTO/OpenStreetMap basemap. Production map-provider, caching and attribution requirements should be reviewed before commercial deployment.
