# Recommendation Log

## REC-20261003-001 — Use evidence tiers for Bray recommendations

- Date: 2026-10-03
- Recommendation: rank verified/mapped Bray parking assets but keep live availability unknown where no live feed exists.
- Recommendation rule: current signage and event restrictions override stored baseline rules.
- Special handling: unknown-access Bray Head/Raheen Park stays visible as evidence but is not treated as verified public access.
- Duplicate handling: Northern Carpark / Bray Town Council Car Park evidence is folded into the North Beach canonical record; NCPS / Bray (Daly) Car Park 2 evidence is canonicalised as one record.
- Rationale: avoid double counting and avoid false certainty.
- Status: implemented.

## REC-20261003-002 — Use imagery to prioritise geometry work, not to manufacture precision

- Date: 2026-10-03
- Recommendation: prioritise the 7 records marked candidate_polygon_allowed for a separate digitisation/reconciliation task.
- Do not count bays or infer current capacity from aerial vehicles.
- Use fresh/authoritative Irish orthophotography where licensing permits; treat older imagery as lower-confidence evidence.
- Records with ambiguous or unconfirmed footprints remain points/corridors until corroborated.
- Status: adopted.

## REC-20261004-001 — Use progressive disclosure for national parking exploration

- Date: 2026-10-04.
- Recommendation: keep the national map concise and progressively reveal detail only after a user selects a region and then a locality.
- Display order: county/region inventory and known-space total → locality location count/known spaces → exact mapped parking points.
- Reason: this prevents national-marker overlap while retaining useful evidence density at each zoom level.
- Mobile rule: controls that change context but are not required for the main parking task should sit behind the + menu.
- Status: adopted in PR #33.

## REC-20261018-001 — Keep national parking counts stable and labelled

- Date: 2026-10-18.
- Recommendation: display one stable evidence-derived count per connected region on the Ireland map and reserve dynamic clustering for detailed/destination views.
- Presentation: region name + mapped/evidence-backed location total should remain readable without requiring hover/tap; capacity may be shown only where published.
- Kildare qualifier: when using the 128-anchor fallback, call it partial/evidence-anchor coverage rather than complete county inventory.
- Status: adopted.

## REC-20261018-002 — Measure coverage completeness before adding more commercial features

- Date: 2026-10-18.
- Recommendation: prioritise a Parking Universe Coverage workstream before payment/reservation/operator features.
- Coverage KPIs: source-universe coverage, geographic gap coverage, candidate resolution rate, verified-access rate, stale-record rate and unresolved-access rate.
- Recommended operating rule: no material known source or geographic gap should remain unprocessed in the target region; unresolved parking should be represented explicitly rather than omitted.
- After this gate: partnerships can become the main product-expansion workstream while automated inventory maintenance continues in parallel.
- Status: adopted.

## REC-20261019-WW01 — County recommendation eligibility controls
- Date: 2026-10-19; status: follow-up review open.
- Guidance: prioritize Wicklow Town, Greystones, Arklow, Glendalough/Laragh, Brittas Bay and inland towns for access/stay/entrance verification.
- Guardrail: do not promote OSM unknown/customer/private/permit-only parking to unrestricted public parking; on-site signage overrides general rules.
- Action: enrich individual sites with maximum stay and tariff only after matching official evidence to location.

## REC-20261020-CL01 — Use zoom-adaptive location aggregation
- Recommendation: preserve county and locality aggregation at overview zoom levels; display one count for nearby parking *locations*, not available bays.
- Detailed mode: reveal distinct ranked parking IDs and actual coordinates as zoom permits; keep source evidence and live availability indicators separate.
- Interaction: tapping a cluster progressively zooms; do not scatter markers to artificial coordinates or leave previous destination ranks on national map.

## REC-20261020-MAP02 — One zoom UI standard for expansion
- Recommendation: use one shared pixel-radius grouping algorithm for all county and subcounty maps, rather than separate per-county marker implementations.
- Avoid external-only clustering dependencies; keep a local fallback if MarkerCluster does not load.
- Use labels explicitly counting parking locations; preserve raw IDs, access restrictions and evidence.

