# WHITEBLOCK UI Design System

## Purpose

WHITEBLOCK should feel visually related to the user's other product projects while remaining recognisable as a spatial-intelligence and parking product.

The interface should be:

- dark and minimal;
- analytical rather than decorative;
- compact but not dense;
- evidence-aware;
- responsive from mobile to large desktop;
- suitable for both a driver-facing product and an enterprise intelligence layer.

## Shared product-family palette

```text
Canvas            #07110D
Primary surface   #0B1712
Elevated surface  #0E1D17
Border             #1E3229
Primary text       #EDF7F1
Muted text         #8FA39A
Primary green      #78E6AA
Secondary green    #52D98D
Lime accent        #C8F56B
```

Supporting semantic colours:

```text
Amber / pressure   #F1C46B
Risk / error       #F08B7E
```

WHITEBLOCK-specific visual identity should come from **white parking-line geometry**, spatial grids, candidate polygons, and map-based interactions rather than introducing an unrelated accent palette.

## Typography

- Display/headings: `Manrope`
- Body/UI: `DM Sans`

Fallback to system sans-serif if remote fonts are unavailable.

Headings should be compact, slightly tight, and sentence case. Avoid oversized marketing typography inside the application.

## Application hierarchy

The initial UI has four primary views:

1. **Find** — destination-first parking recommendation.
2. **Discover** — supply discovery/change-detection research layer.
3. **Network** — parking-network optimisation and B2B intelligence.
4. **Evidence** — provenance, confidence, truth state and freshness.

Desktop uses a left navigation rail. Mobile uses a persistent bottom navigation with at least 44px touch targets.

## Find view

The first user question is:

> Where should I park for this destination, arrival time and stay duration?

The screen should prioritise:

1. destination/trip controls;
2. compact filters;
3. coverage/availability/confidence/pressure KPIs;
4. map and ranked recommendation cards;
5. an explanation of *why* each location is recommended.

Avoid beginning with a generic map full of pins.

## Recommendation cards

Each recommendation should expose only the most decision-relevant information in the first scan:

- ranking;
- name/location;
- availability state;
- available spaces when known;
- walk time;
- estimated cost;
- confidence;
- short explanation.

Future production cards may add restrictions, accessible/EV attributes, arrival-time forecast bands and payment/navigation actions.

## Truth-state semantics

The visual layer must preserve the data architecture's distinction between:

- **Observed** — trusted source/ground observation;
- **Inferred** — derived from imagery/geometry/repeated evidence;
- **Predicted** — future state produced by a model;
- **Unverified** — candidate evidence not suitable for normal public recommendation.

The UI must never make an inferred/predicted value visually indistinguishable from observed truth when that distinction is material.

## Discovery view

Discovery should feel like a spatial-research workspace, not a consumer feature.

Use:

- aerial/spatial motifs;
- candidate outlines;
- change-detection language;
- explicit verification status;
- new supply / lost supply / underused capacity / imagery freshness.

A candidate WhiteBlock is not public parking until verified.

## Network view

The Network view should be more strategic and enterprise-oriented.

Primary concepts:

- Parking Supply Adequacy;
- demand forecast;
- occupancy imbalance;
- redistribution opportunities;
- optimise-before-expand recommendations.

The purpose is to answer *how the parking system should behave*, not only where an individual should park.

## Evidence view

Every material asset fact should eventually support drill-down to:

- source;
- truth state;
- confidence;
- source timestamp;
- retrieval timestamp;
- freshness;
- conflicting evidence if present.

The first UI uses a compact evidence table, but production should provide an asset-level evidence drawer or side panel.

## Responsive rules

### Desktop

- persistent left sidebar;
- map + recommendation panel side-by-side;
- four-column KPI strip where space permits;
- multi-column research/strategy cards.

### Tablet

- compact icon navigation rail;
- map above recommendations when horizontal space is constrained;
- two-column parking-card grid where appropriate.

### Mobile (320–820px)

- no desktop sidebar;
- persistent bottom navigation;
- compact 2 × 2 KPI layout;
- map stacked above recommendation cards;
- horizontal scrolling for filter chips;
- evidence tables may scroll horizontally until a dedicated mobile evidence card is implemented;
- controls should have 44px+ effective touch areas.

## Demo-data policy

Until the frontend is connected to the WHITEBLOCK API/PostGIS service, all values presented in the prototype must be explicitly labelled as prototype/demo data.

Do not visually represent demo values as real live Cork availability.

## Current implementation

Static application shell:

```text
web/
├── index.html
├── styles.css
└── app.js
```

Run locally with:

```bash
python -m http.server 8000 -d web
```

Then open `http://localhost:8000`.

The static shell is intentionally framework-light so the product model and interaction design can stabilise before selecting a production frontend stack.

## Next UI integrations

1. Replace demo inventory with a read-only WHITEBLOCK API backed by PostGIS.
2. Add destination geocoding and walking/driving route computation.
3. Connect live/historical observations to cards and map markers.
4. Add arrival-time availability forecasts with confidence bands.
5. Add asset evidence drawer.
6. Add candidate review workflow for the Discovery view.
7. Add operator/council analytics filters in Intelligence mode.
8. Add saved preferences, accessible/EV defaults and session state.
