# WHITEBLOCK API

## Purpose

The WHITEBLOCK API is the production-facing read-only layer between the browser application and the PostGIS spatial core.

GitHub Pages remains a static frontend and **must not receive database credentials**. The browser therefore uses the following priority:

1. WHITEBLOCK API, when an API base URL is configured.
2. The evidence-backed Cork snapshot generated during the GitHub Pages build.
3. No demo parking values.

This keeps the current public prototype usable while allowing the application to move to live PostGIS queries without redesigning the UI again.

## Local development

Start PostGIS and the API:

```bash
docker compose up --build
```

The API is then available at:

```text
http://localhost:8080
```

Health check:

```text
GET /health
```

## Nearby parking

```text
GET /v1/parking/nearby
```

Query parameters:

- `lat` — destination latitude.
- `lng` — destination longitude.
- `radius_km` — search radius, 0.1–25 km; default 5 km.
- `limit` — maximum returned records, 1–50; default 8.
- `include_restricted` — include permit/private/customer/restricted inventory when true; default false.

Example:

```text
/v1/parking/nearby?lat=51.8985&lng=-8.4756&radius_km=5&limit=8
```

The endpoint performs the spatial filter in PostGIS using `ST_DWithin` and orders by distance from the destination.

Returned parking facts include:

- canonical `parking_id`;
- name and coordinates;
- distance from destination;
- parking/access/lifecycle classification;
- latest available/capacity/occupancy observation;
- observation timestamps;
- pricing/opening/height metadata;
- accessible and EV counts when known;
- truth state;
- evidence count;
- evidence-derived confidence.

## Confidence

The API derives a composite confidence value from three components:

```text
55% source confidence
30% observation freshness
15% field completeness
```

This is intentionally consistent with the static Pages snapshot exporter so switching between API and snapshot modes does not change the meaning of confidence.

Confidence is not a model-accuracy score. It expresses how strongly WHITEBLOCK can support the displayed parking fact from the currently available evidence.

## Evidence

```text
GET /v1/parking/{parking_id}/evidence
```

Returns the source-level evidence held for a canonical parking asset, including source key/type, timestamp, truth state, confidence and evidence payload.

This endpoint is the basis for the future asset evidence drawer in the application.

## Browser configuration

`web/runtime-config.js` defaults to:

```javascript
window.WHITEBLOCK_CONFIG = {
  apiBaseUrl: null
};
```

With `apiBaseUrl=null`, the browser uses the build-time Cork snapshot.

For the deployed GitHub Pages application, define a GitHub repository variable named:

```text
WHITEBLOCK_API_BASE_URL
```

For example:

```text
https://api.whiteblock.example
```

The Pages workflow writes that value into `runtime-config.js` during deployment. No API URL needs to be hard-coded into the source tree.

If the configured API cannot be reached, the browser retains the latest evidence-backed snapshot rather than substituting fabricated/demo records.

## Environment variables

API runtime:

```text
DATABASE_URL
WHITEBLOCK_CORS_ORIGINS
```

`WHITEBLOCK_CORS_ORIGINS` is a comma-separated allow-list. The default development configuration allows the WHITEBLOCK GitHub Pages origin and localhost.

## Deployment boundary

The repository now contains the API runtime and Docker image definition, but GitHub Pages cannot host Python/PostGIS services.

The production backend therefore needs a container-capable host with:

- HTTPS;
- environment-secret support;
- connectivity to PostgreSQL/PostGIS;
- health monitoring;
- appropriate scaling and request limits.

Until that backend is hosted and `WHITEBLOCK_API_BASE_URL` is configured, the public application continues to use the hourly generated Cork snapshot.

## Next API extensions

- destination-aware rule eligibility;
- route-based drive/walk time rather than approximate straight-line walking time;
- arrival-time availability forecasts;
- tariff normalization and trip-cost calculation;
- accessible/EV-specific availability;
- parking guidance-display observations;
- evidence/conflict drill-down;
- authenticated operator/council endpoints;
- broader city coverage after source onboarding and reconciliation.
