# Universal marker and county-onboarding policy — 20 October 2026

## Scope
This is the **only** marker grouping contract for WHITEBLOCK's current and future source-backed county networks. It applies to Cork, Kildare, Dublin, Wicklow (including the Bray locality evidence pilot) and new counties registered by their adapters.

### Zoom hierarchy
1. **National:** one county-level marker/card for each connected region. Do not render leftover ranked 01–07 recommendation overlays while browsing.
2. **County:** one label/count per locality; geographically neighboring locality labels group when 126px cards would overlap. A group badge shows *number of localities* and *number of mapped parking locations*.
3. **Locality:** a compact marker with the number of distinct mapped parking locations replaces close/overlapping site markers. A tap zooms in, splitting groups as actual coordinates separate.
4. **Destination results:** nearby ranked parking locations use the same screen-space clustering. A group badge shows the count of **locations**, and individual labels 01–10 appear at detailed zoom when geographically distinguishable.
5. **Full inventory map:** MarkerCluster groups every loaded source-backed region's parking assets. If the external plugin fails to load, an internal map-level clustering fallback still avoids thousands of unclustered markers.

Shared defaults in `web/parking-marker-policy.js`: 56px parking-radius grouping, 132px locality cards, detailed parking marker zoom 17, detailed locality zoom 16, parking footprint display zoom 14. The ranked MapLibre layer adds a 46px collision check at detail zoom and a display-only spider fan when individual markers would still collide. These are presentation defaults, **not** geographic distances or evidence of real-time vacant spaces.

## Current/future data adapter contract
- Write source-backed normalized locations into `state.regionInventories[regionKey]` with stable IDs and numeric coordinates, and the validated snapshot into `state.regionSnapshots[regionKey]`.
- The overview automatically registers additional county keys when the snapshot and locations are both present; it computes a navigation centroid and inserts the county into the switcher. More accurate official county centre/zoom metadata can still be configured when available.
- Dispatch `whiteblock:region-inventory-ready` after loading. Existing province/pilot keys (e.g. `bray`, `corkCounty`) stay attached to the parent county. New geographic supply does **not** require new clustering code.
- A county snapshot must not overclaim completeness, public access, tariff, maximum stay, parking capacity, or live occupancy; retain source and provenance.
- Both full inventory and ranked overlay reuse `window.WHITEBLOCK_MARKER_POLICY`. Canonical IDs are deduplicated across canonical/supplemental pools; this is **not** a guarantee that different IDs represent distinct physical sites. Source reconciliation is still necessary.
- Cluster marker coordinates are display centroids only; original individual parking coordinates never change.

## Operational guardrails
- Group labels count mapped **parking locations**, not individual bays or confirmed vacant spaces.
- Never re-center or refit the user-selected map view on ordinary zoom.
- At detailed zoom, screen-colliding ranked options are fanned into a display-only spider layout with connector lines back to their true coordinates. Their canonical coordinates never change. This applies generically to all regions and avoids unreadable marker stacks where several source-backed records share an entrance or lie only a few metres apart.
- Do not stop at an arbitrary 300 visible parking-site cutoff. Draw aggregated sites at broad scales, and only detailed points in/near the current viewport at high zoom.
- The MarkerCluster CDN is a best-effort enhancement: the built-in grouping fallback remains available if external scripts are blocked.

## QA release gate
- CI: `node tests/test_ranked_gl_clustering.js` and `node tests/test_universal_marker_policy.js`; Python suite and JS syntax checks.
- Before closing full QA: Android browser test across each current region and Bray locality. Check pinch-out collapse, pinch-in expansion, cluster tap, switching national→county→locality→destination, Street/Terrain/Satellite, delayed-source loads, and network-failed MarkerCluster fallback.
- Onboarding test for a future county with an actual source-backed snapshot; automated Donegal/Galway fixtures prove code paths, **not** actual new parking coverage or source completeness.
- Source of truth: `web/parking-marker-policy.js`, the region adapter contract, and individual project logs.

## Renderer ownership
The native MapLibre ranked overlay owns destination result circles/labels and footprints when available. Leaflet map engine draws an emergency ranked fallback only until MapLibre announces readiness; both must not draw the same numbered site markers simultaneously. Map engine clears its prior Leaflet layer on `whiteblock:ranked-gl-overlay-ready`, and guards against rendering fallback while native GL owns them.
