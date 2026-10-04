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
