# Parking map rendering

WHITEBLOCK renders the basemap and ranked parking geometry in the same MapLibre canvas.

## Why

Android Chrome exposed a layering failure when the basemap was rendered by MapLibre while ranked parking polygons were drawn in separate Leaflet SVG panes. The basemap remained visible but parking polygons and ranked labels could disappear.

## Current contract

- MapLibre owns Street / Terrain / Satellite rendering.
- `parking-gl-overlay.js` adds the top ranked parking results as a GeoJSON source directly to MapLibre.
- Every ranked result receives an immediately visible estimated polygon and numbered point marker.
- OpenStreetMap parking geometry, when matched, replaces the estimated polygon.
- Mapped polygons use a solid outline; estimated polygons use a dashed outline.
- Selecting a result updates the same GeoJSON source, highlights that parking area and focuses the map locally.
- Map style changes re-add the WHITEBLOCK parking source/layers on `style.load`.

Leaflet remains the navigation/state bridge and supports other application overlays, but ranked parking geometry no longer depends on cross-engine pane ordering.
