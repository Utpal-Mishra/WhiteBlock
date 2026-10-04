# Risk & Assumption Log

## RISK-20261003-001 — Historical imagery staleness

- Risk: aerial/street imagery may not reflect current layout.
- Likelihood: medium.
- Impact: high if used for capacity/legal claims.
- Mitigation: use imagery only as physical-supply evidence; keep bay count/capacity unverified until fresh imagery or field survey.
- Status: open.

## RISK-20261003-002 — Duplicate/alias parking records

- Risk: adjacent or renamed listings can double count the same facility.
- Likelihood: high.
- Impact: medium-high.
- Mitigation: canonicalise near-identical coordinates/names and preserve aliases as evidence.
- Status: mitigated for North Beach and NCPS/Station Car Park 2 records.

## RISK-20261003-003 — Baseline rule versus temporary restriction

- Risk: events/works/local signs can override stored rules.
- Likelihood: medium.
- Impact: high.
- Mitigation: display verification language; model event restrictions as time-bounded evidence; signage always wins.
- Status: open; event automation pending.

## ASM-20261003-001 — Public-access interpretation

- Assumption: facilities explicitly represented as public car parks / council parking zones are usable by the public subject to local rules.
- Control: unknown/ambiguous access remains unknown, never silently promoted to public.

## RISK-20261003-004 — Imagery can look precise while being legally or temporally wrong

- Risk: visible vehicles/pavement may be private, temporary, obsolete, event-controlled or misaligned with a mapped point.
- Likelihood: high across heterogeneous county inventories.
- Impact: high if promoted directly to public parking.
- Mitigation: separate physical-supply review from access/rules/live occupancy; explicit stale/ambiguous states; no automatic polygons.
- Status: controlled.

## RISK-20261003-005 — Imagery licensing and derivative-storage risk

- Risk: copying third-party imagery into the public repository can violate provider terms or create avoidable redistribution obligations.
- Mitigation: imagery remains short-lived CI review artifacts; repo stores metadata/conclusions only; preserve attribution/provider provenance.
- Status: controlled.

## RISK-20261003-006 — Kildare external inventory refresh can time out

- Risk: full County Kildare Overpass traversal can exceed deployment time or fail at public endpoints.
- Impact: Kildare previously disappeared from the deployed snapshot.
- Mitigation: bounded exact-boundary attempt plus explicitly partial KCC/maintained-anchor fallback; UI must label partial coverage.
- Status: mitigated in PR #32.

## RISK-20261004-001 — Aggregated map totals can be misread as complete or live

- Date: 2026-10-04.
- Risk: users may interpret a regional location/capacity total as complete real-world supply or current availability.
- Likelihood: medium.
- Impact: high for recommendation trust.
- Mitigation: label capacity as known/published only; display live free-space values only when reported; retain Bray as an explicit pilot; locality groups are derived from existing mapped evidence and never create new parking records.
- Residual risk: source inventories remain incomplete in some areas and subarea labels depend on available settlement/area metadata.
- Status: controlled; continue evidence enrichment and deployed UX review.
