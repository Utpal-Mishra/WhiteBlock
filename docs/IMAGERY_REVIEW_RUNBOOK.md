# WHITEBLOCK Aerial Imagery Review Runbook

## Purpose

WHITEBLOCK uses aerial/satellite imagery as a **physical parking-supply evidence source**. Imagery can help determine whether a mapped parking feature is physically visible, whether a point represents curb/lane parking or a surface lot, whether the footprint is clear enough for a later geometry-digitisation task, and whether a mapped record needs field or fresher-imagery validation.

Imagery does **not** establish legal/public access, current pricing, maximum stay, current capacity or live occupancy.

## Evidence states

Permanent review results use four states:

- **physical_parking_visible** — physical parking is clearly visible around the mapped record.
- **parking_context_visible_extent_ambiguous** — parking is visible nearby but the exact feature/extent cannot be safely derived.
- **no_distinct_parking_footprint** — the reviewed frame does not confirm a distinct parking footprint at the mapped point.
- **visible_but_stale_imagery** — physical parking appears visible, but the imagery is too old for strong present-layout confidence.

Geometry actions are independent:

- **candidate_polygon_allowed** — create a follow-up digitisation/reconciliation task; no polygon is created automatically.
- **keep_point_or_corridor** — retain point/on-street/corridor semantics.
- **field_verification_required** — fresh imagery, Street View or site verification is required.
- **no_geometry_change** — imagery did not justify geometry enrichment.

## 2026-10-03 first cross-region review

Review ID: **WB-IMG-20261003-001**

Regions:
- County Dublin — 8 high-priority open geometry records reviewed.
- County Cork — 8 high-priority open geometry records reviewed.
- County Kildare — 8 evidence anchors reviewed.
- Bray, County Wicklow — all 7 current Bray canonical records reviewed.

Total: **31 reviewed assets**.

Results:
- 17 physical parking visible
- 9 parking context visible but footprint ambiguous
- 3 distinct parking footprints not confirmed
- 2 visible only in older imagery
- 7 records suitable for a separate candidate-polygon digitisation/reconciliation task
- 0 polygons automatically created
- 0 live occupancy values inferred

The source-of-truth conclusions are stored in **config/imagery_review_evidence.json**. The imagery pixels themselves are not stored in the repository.

## Review workflow

Regional parking snapshots → target selection → temporary aerial review frames → human physical-supply review → metadata-only conclusions → imagery evidence configuration → build-time snapshot overlay → application / Discover / Evidence UI.

The GitHub Actions workflow **.github/workflows/imagery-review.yml** creates temporary review frames and contact sheets. Those images are short-lived workflow artifacts only.

## Target-selection rules

The first-pass queue:
- requires valid coordinates;
- targets records without observed parking geometry;
- excludes private, permit, restricted and customer/destination-only parking from the default open-supply review;
- excludes underground/multi-storey records where overhead imagery is unlikely to represent usable internal capacity;
- gives priority to explicit public/permissive access, named assets, known capacity and stronger source confidence;
- spatially spreads the first-pass batch to avoid reviewing many duplicates at the same facility.

This queue is repeatable and can be expanded in later batches.

## Provider and provenance

The 2026-10-03 review used Esri World Imagery for temporary review frames because it exposes a stable tiled imagery service plus source/date/resolution metadata.

Permanent evidence stores the imagery provider/product, acquisition date where available, published resolution where available, review date, review result, geometry action, confidence, reviewer note, and explicit legal/access and occupancy caveats.

Provider imagery is not copied into WHITEBLOCK's public repository. For production-grade Irish geometry work, appropriately licensed Tailte Éireann orthophotography should be preferred where access and licensing permit because it provides authoritative Irish national aerial coverage.

## Application integration

During Pages deployment, **scripts/apply_imagery_review_evidence.py** overlays matching review conclusions onto regional snapshots.

A reviewed record receives an **imagery_review** object. The overlay must never set available/occupied spaces, change access type, create a polygon automatically, or convert an unknown/private/restricted asset into public parking.

**candidate_polygon_allowed** means only that a human-reviewed physical lot appears clear enough for a later geometry task.

## Kildare resilience

The full County Kildare inventory remains the preferred exact-boundary source. If it cannot refresh inside the deployment time budget, WHITEBLOCK publishes an explicitly partial fallback composed of Kildare County Council accessible-parking evidence and maintained high-confidence parking anchors.

The fallback is marked with **scope = partial_evidence_anchors**, **coverage_claim = partial_not_county_complete**, and **coverage_complete = false**. The UI must display that partial status rather than describing it as complete county coverage.

## QA checklist

Before merging an imagery review:
1. Review file contains no imagery pixels.
2. Every evidence record maps to a known parking ID or is explicitly quarantined.
3. No legal/access field changed from imagery alone.
4. No live availability was inferred.
5. Stale imagery is explicitly labelled.
6. Ambiguous imagery does not generate a polygon.
7. Regional snapshots still validate.
8. App UI distinguishes imagery review from observed live occupancy.
