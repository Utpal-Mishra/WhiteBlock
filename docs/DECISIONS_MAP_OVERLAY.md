# Decision: render ranked parking geometry in MapLibre

Date: 2026-09-21

WHITEBLOCK previously rendered the basemap in MapLibre and ranked parking polygons in separate Leaflet SVG panes. On Android Chrome this produced a failure mode where the basemap remained visible but the parking polygons and numbered markers were not rendered visibly.

Decision:
- render ranked parking polygons and numbered points as a GeoJSON source and MapLibre layers in the same canvas as the basemap;
- retain Leaflet as the application navigation/state bridge;
- use estimated dashed polygons immediately, then replace them with matched OpenStreetMap parking geometry where available;
- re-attach the parking source/layers after every MapLibre style change.

This becomes the default rendering contract for ranked parking results.
