# WHITEBLOCK Inventory Coverage

Inventory Coverage is the operational view of parking records currently known to WHITEBLOCK. It is deliberately separate from the driver recommendation view.

## Connected regions

### Cork

- official Cork parking snapshot;
- current capacity and availability where reported;
- live-observation pilot semantics.

### County Kildare

- Kildare County Council accessible-parking layer;
- OpenStreetMap parking inventory;
- capacity/access/EV/fee/opening-hour attributes where published;
- no county-wide live occupancy claim.

The Kildare inventory is searched alongside Cork by name, town/area, asset ID, source and parking type. The UI renders at most 100 matching cards at once for mobile performance while filtering the complete regional inventory in memory.

## Region and status filtering

Inventory Coverage supports:

- All connected regions;
- Cork;
- Kildare;
- Canonical inventory only;
- Unverified candidate queue only;
- Inventory + candidates.

Region cards distinguish canonical inventory count, candidate count, known capacity and reported availability. A missing Kildare availability value is shown as unknown rather than inferred.

## Adding a parking location

`Add parking location` creates a **parking candidate**, not a canonical parking asset.

For Kildare:

1. the supplied address/place is geocoded;
2. the resulting point must fall within the current published Kildare coverage envelope;
3. the record receives a `WB-CAND-IE-KILDARE-LOCAL-*` identifier;
4. truth state is `unverified`;
5. availability and confidence remain unset;
6. the candidate is excluded from driver recommendations.

Because the public site is GitHub Pages and no authenticated write service is connected, candidate records are currently stored in browser `localStorage` on the device that created them. This avoids exposing an unauthenticated public database-write endpoint.

A production write path should require authenticated identity, server-side validation, audit logging and review/promotion workflow before writing to `parking_candidate` / `parking_location` in PostGIS.

## Promotion rule

Candidate status must remain separate from canonical parking inventory until the existing evidence lifecycle has been satisfied:

`DETECTED → CANDIDATE → PHYSICAL PARKING CONFIRMED → ACCESS STATUS CHECKED → RULES VERIFIED → PUBLIC/PRIVATE CLASSIFICATION → PUBLISHED`

Inventory Coverage may show candidates for review, but Find/Recommendations must only use connected canonical inventory according to the region's evidence rules.
