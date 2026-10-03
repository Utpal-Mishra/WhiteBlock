# Architecture Log

## ARCH-20261003-001 — Regional adapter pattern

- Date: 2026-10-03
- Decision: introduce Bray through a regional adapter rather than modifying the Cork authoritative ingestion contract.
- Rationale: Cork is live-feed oriented; Bray currently has heterogeneous evidence and no equivalent authoritative live occupancy feed.
- Pattern:
  1. region evidence snapshot
  2. region adapter
  3. shared canonical browser inventory
  4. shared ranking/map/evidence UI
- Boundary: the PostGIS/API Cork gate is captured before the regional coverage gate is widened.
- Data semantics: stable asset facts and rule evidence can be added; live occupancy must remain separate and absent when unsupported.
- Future path: migrate Bray into the persistent reconciliation/PostGIS layer once an automated source pipeline is available.
- Status: accepted for evidence-pilot stage.

## ARCH-20261003-002 — Imagery evidence is a sidecar, not a replacement source of truth

- Date: 2026-10-03
- Decision: store human-reviewed conclusions as metadata sidecar evidence and overlay them onto regional snapshots at build time.
- Rationale: keeps imagery provenance separate from legal/access and live-observation domains; avoids copying provider imagery into the repository.
- Architecture: regional source → canonical asset → imagery-review sidecar → deployment overlay → UI evidence.
- Geometry policy: candidate_polygon_allowed creates a later digitisation task only; geometry remains null until independently digitised/reconciled.
- Status: accepted.
