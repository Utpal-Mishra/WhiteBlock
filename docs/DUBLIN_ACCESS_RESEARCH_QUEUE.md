# County Dublin Access-Evidence Research Queue

## Objective

Turn unresolved parking-access evidence into a structured enrichment programme. This queue does **not** claim a parking location is public, free, available, or legally usable. It identifies where access evidence is missing or ambiguous so verification work can be directed where it has the greatest coverage impact.

The queue is based on the validated County Dublin snapshot generated on **2026-09-23T03:21:42Z**:

- 9,005 mapped parking assets
- 4,442 raw `unknown` access assets
- 1 additional `designated` asset retained as uncertain
- **4,443 unresolved access assets in the WHITEBLOCK access taxonomy**

Mandatory coverage claim remains:

`complete_boundary_traversal_not_complete_real_world_inventory`

## Priority method

Priority is intentionally deterministic rather than an opaque model score:

- **P0** — 100+ unresolved access assets in a settlement
- **P1** — 50–99
- **P2** — 20–49
- **P3** — 1–19

Within each tier, higher unresolved volume is handled first. Unresolved share is secondary context: it helps identify settlements where most mapped supply still lacks access evidence.

This is an **evidence-resolution priority**, not a parking-demand, shortage, or investment score.

## County-level queue

| Local authority | Mapped assets | Unresolved access | Settlements with unresolved access |
| --- | ---: | ---: | ---: |
| Dublin City | 2,523 | 1,111 | 64 |
| Fingal | 2,123 | 1,522 | 33 |
| Dún Laoghaire–Rathdown | 1,854 | 1,212 | 35 |
| South Dublin | 2,505 | 598 | 26 |
| **Total** | **9,005** | **4,443** | **158** |

Queue distribution:

- P0: 7 settlements
- P1: 14 settlements
- P2: 41 settlements
- P3: 96 settlements

## P0 — highest-volume unresolved evidence

| Local authority | Settlement | Unresolved | Mapped assets | Unresolved share |
| --- | --- | ---: | ---: | ---: |
| Fingal | Mulhuddart | 344 | 390 | 88.2% |
| Fingal | Swords | 288 | 426 | 67.6% |
| Fingal | Castleknock | 217 | 270 | 80.4% |
| Dún Laoghaire–Rathdown | Ballyogan | 162 | 169 | 95.9% |
| Fingal | Balbriggan | 130 | 139 | 93.5% |
| Dublin City | Finglas | 125 | 208 | 60.1% |
| Dún Laoghaire–Rathdown | Cherrywood | 117 | 134 | 87.3% |

Resolving just these seven settlement queues can materially reduce the county-wide unknown-access inventory without adding a single new generic parking point.

## P1 — second enrichment wave

| Local authority | Settlement | Unresolved | Mapped assets | Unresolved share |
| --- | --- | ---: | ---: | ---: |
| Dún Laoghaire–Rathdown | Ballybrack | 85 | 107 | 79.4% |
| South Dublin | Palmerstown | 85 | 171 | 49.7% |
| South Dublin | Tallaght | 74 | 158 | 46.8% |
| Dún Laoghaire–Rathdown | Kilternan | 72 | 80 | 90.0% |
| South Dublin | Clondalkin | 70 | 266 | 26.3% |
| Dún Laoghaire–Rathdown | Windy Arbour | 69 | 70 | 98.6% |
| Dublin City | Ballsbridge | 65 | 93 | 69.9% |
| Dublin City | Ballyfermot | 64 | 85 | 75.3% |
| Dublin City | Ballymun | 62 | 187 | 33.2% |
| Dún Laoghaire–Rathdown | Blackrock | 59 | 101 | 58.4% |
| Dún Laoghaire–Rathdown | Carrickmines | 52 | 56 | 92.9% |
| Dún Laoghaire–Rathdown | Kilmacud | 51 | 62 | 82.3% |
| South Dublin | Greenhills | 51 | 78 | 65.4% |
| Dún Laoghaire–Rathdown | Loughlinstown | 50 | 59 | 84.7% |

## Verification sequence per settlement

For each unresolved asset, apply evidence in this order where relevant:

1. **Official local-authority evidence** — public car parks, regulated parking zones, parking-meter or parking-tag datasets. A regulatory point is evidence only; it must not be fabricated into parking-area geometry.
2. **Parking/operator evidence** — operator terms, tariff pages, access restrictions, opening hours, max stay.
3. **Venue/store-specific evidence** — supermarket, shopping-centre, hotel, leisure, hospital or other destination parking terms. Restrictions must be specific to the individual facility; no chain-wide two-hour rule is assumed.
4. **OpenStreetMap evidence/history** — `access`, `fee`, `maxstay`, `opening_hours`, `operator`, `parking:condition:*`, and source/history where useful.
5. **Imagery review** — only to verify likely physical parking layout or candidate supply. Satellite/aerial imagery cannot establish legal/public/customer access by itself.

## Required evidence fields

When an unresolved asset is enriched, preserve:

- `access_type`
- `customer_only`
- `maximum_stay_minutes`
- `opening_hours`
- `fee` / tariff evidence when known
- `operator`
- `enforcement_notes` when sourced
- `source_key` and/or source URL
- `source_observed_at`
- evidence/truth state
- confidence/basis

A state change from Unknown must be traceable to direct evidence. Absence of a restriction is not evidence of public access.

## Driver suitability consequence

Once evidence is resolved:

- Public parking may enter normal recommendation ranking, subject to time, max-stay and other session rules.
- Customer/destination parking remains conditional and must be labelled accordingly.
- Private/permit/restricted parking remains in the evidence/network inventory but is excluded from normal driver recommendations.
- Unknown remains unknown until direct evidence supports another state.

## Automation

`scripts/build_dublin_access_research_queue.py` builds the machine-readable queue from a validated Dublin snapshot. The script uses the same precision claim and produces authority/settlement summaries plus P0–P3 research rows. Its tests deliberately verify that `designated` is not silently promoted to public parking.
