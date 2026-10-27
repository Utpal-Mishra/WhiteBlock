# Phase 4 — Parking Supply Discovery

**Status:** Active foundation from 2026-10-27.

Phase 4 converts imagery/GIS detections into governed evidence candidates without allowing visual evidence to become public/recommendable parking automatically.

## Implemented foundation

- `parking_detection_batch.schema.json` defines the adapter contract for segmentation/detection outputs.
- `parking_supply_candidate.schema.json` defines stable `WB-CAND-*` candidate records.
- `phase4_imagery_sources.json` is a fail-closed licensing/source registry.
- `build_parking_supply_discovery.py`:
  - seeds follow-up work from existing human imagery reviews;
  - accepts optional automated detection batches only from explicitly approved source contracts;
  - cross-matches detections against current canonical parking snapshots;
  - separates same-location review, geometry extension and new-supply candidates;
  - produces an auditable verification queue.
- `build_parking_supply_change_report.py`:
  - compares versioned detection batches;
  - identifies appeared, expanded, contracted and disappeared/obscured candidates;
  - treats every material change as a review trigger rather than an automatic inventory mutation.
- Discover exposes the Phase 4 programme state and verification workload.

## Candidate lifecycle

```text
licensed imagery/detection evidence
             ↓
surface-parking detection
             ↓
cross-match canonical WB-PARK-* inventory
       ┌─────┴───────────┐
       ↓                 ↓
 known/extension      possible new supply
       ↓                 ↓
         WB-CAND-* registry
                 ↓
        human/evidence review
                 ↓
  access + rules + geometry verification
                 ↓
      promote / reject / retain candidate
```

A `WB-CAND-*` record is never a driver recommendation. Promotion requires a separate evidence-backed decision.

## Licensing gate

The repository currently contains human-review metadata from Esri World Imagery. That does **not** establish that WHITEBLOCK may download/store provider pixels or run automated ML analysis over them.

Accordingly:

- existing Esri review metadata remains usable as recorded evidence;
- automated ingestion is disabled for that source contract;
- any automated detection batch must name a registered source with `machine_ingestion_allowed=true`;
- provider/product, machine-analysis rights, retention/storage terms and attribution requirements must be recorded before enabling an adapter.

This is intentionally fail-closed.

## Cross-match policy

Default Cork foundation thresholds:

- <=25 m: same-location review;
- >25 m and <=75 m: possible geometry extension;
- >75 m: possible new supply;
- confidence <0.65: low-confidence quarantine.

These are candidate-routing thresholds, not final truth thresholds. They should be tuned using a labelled Cork benchmark.

## Change detection

When two versioned detection batches become available, Phase 4 can identify:

- appeared detection;
- expanded surface;
- contracted surface;
- disappeared or obscured detection;
- persistent detection.

A disappearance may mean redevelopment, occlusion, seasonal obstruction, model failure or source differences. It therefore cannot retire a canonical parking asset automatically.

## Evaluation still required

Phase 4 is not complete until Cork demonstrates:

- labelled benchmark coverage;
- candidate precision/recall;
- false-positive analysis;
- false-negative analysis;
- duplicate/cross-match error rate;
- candidate-to-verified conversion rate;
- repeatable human verification;
- safe promotion into canonical inventory.

Bay/capacity estimation is supported as an estimated field in detection/candidate contracts but is not yet considered validated.
