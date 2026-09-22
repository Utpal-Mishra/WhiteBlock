# County Dublin Integration Log

Status: browser/data/deployment integration implemented on 2026-09-22.

This log records the integration phase that connects the County Dublin exact-boundary parking inventory and settlement audit into the WHITEBLOCK browser experience and GitHub Pages build.

## Integration objective

Connect the Dublin parking snapshot, mapped-inventory coverage ledger and named-settlement audit without weakening the project precision rules.

The integration must preserve these distinctions:

- a named settlement anchor is a search/navigation anchor, not parking geometry;
- a settlement with zero matched mapped parking is a research gap, not proof that no parking exists;
- a mapped parking asset with unknown access is not promoted to public parking;
- a council meter/sign/tag record is regulatory evidence unless independent geometry proves a parking asset;
- county-wide source traversal is not a claim of exhaustive real-world parking coverage.

## 2026-09-22 — Integration step 1: publish settlement anchors with the Dublin snapshot

Updated `scripts/ingest_dublin_county_parking_stable.py` so the named city/town/village/suburb/neighbourhood anchors already returned during each exact local-authority parking traversal are retained in the generated Dublin snapshot.

This means settlement assignment, settlement audit and browser search can use the same boundary traversal evidence rather than relying on a second place query.

Snapshot additions:

- `settlement_anchors`
- `summary.settlement_anchor_records`
- `summary.settlement_anchor_types`
- `coverage.settlement_anchor_source`

Commit: `69ab1055520dcc86c44460ee4caf0be18bcb2783`.

Repository test run for this commit: passed.

## 2026-09-22 — Integration step 2: reuse the published anchor evidence in the settlement audit

Updated `scripts/build_dublin_settlement_audit.py`.

The audit now:

- prefers `snapshot.settlement_anchors` from the same exact-boundary parking traversal;
- keeps the older place-only query only as a backwards-compatible fallback;
- retains representative coordinates for named settlements;
- collapses duplicate same-name anchors within one authority while keeping the duplicate count visible;
- records how many audited settlement rows have coordinates;
- labels the evidence mode explicitly.

Representative settlement coordinates are search/navigation anchors only and are never converted to parking geometry.

Commit: `c676f7ba3af6706ceda659abc5e2124d10d9f102`.

Repository test run for this commit: passed.

## 2026-09-22 — Integration step 3: make the settlement audit a deployment sidecar

Updated `scripts/build_dublin_coverage_ledger.py` so the same command used by the GitHub Pages Dublin build now publishes both:

- `web/data/dublin_coverage_ledger.json`
- `web/data/dublin_settlement_audit.json`

This removes the risk of deploying the Dublin parking snapshot without the settlement audit required by the browser integration.

Commit: `16e23b55edd3607d2a891993b05cc88ebf9d2337`.

Repository test run for this commit: passed.

The independent County Dublin coverage workflow was triggered and is rebuilding the exact-boundary Dublin evidence with the new settlement-anchor model.

## 2026-09-22 — Integration step 4: browser settlement-audit adapter

Added `web/dublin-settlement-integration.js`.

The adapter loads and validates:

- `web/data/dublin_settlement_audit.json`
- `web/data/dublin_coverage_ledger.json`

It rejects an audit that does not carry the County Dublin scope, mandatory precision disclaimer or the configured four local-authority relation IDs.

Browser integrations:

### Search

Audited named settlements with observed coordinates are added to the existing WHITEBLOCK place-search fallback collection. These entries are destination anchors only. Parking recommendations continue to come from mapped parking records.

### Discover

Adds a County Dublin settlement-audit panel showing:

- named settlements checked;
- settlements with mapped inventory;
- settlement research gaps;
- unknown-access parking assets;
- searchable settlement anchors;
- a prioritised sample of zero-inventory settlements for evidence investigation.

### Network

Adds Dublin settlement coverage and uncertainty totals beneath the Dublin network panel.

### Evidence

Adds a settlement-level uncertainty queue prioritising zero-inventory settlements and settlements with high unknown-access counts.

Commit: `b3cece6c540013cffda8c9de18d3faa91fee56e9`.

## 2026-09-22 — Integration step 5: runtime loading order

Updated `web/runtime-config.js` so the load order is:

1. Dublin parking network;
2. Dublin settlement integration;
3. inventory coverage UI.

This ensures the Dublin audit is available before the generic coverage surface renders.

Commit: `685a1ed0325d471499b9affe93eddcf759226782`.

GitHub Pages deployment run `96` was triggered for this browser integration. At the time of this log entry the workflow had started successfully and was progressing through the regional snapshot build chain; no integration failure had been recorded.

## 2026-09-22 — Integration step 6: syntax/CI protection

Updated `.github/workflows/test.yml` to include:

`node --check web/dublin-settlement-integration.js`

Commit: `cacc294945541085c6c7e52675dfdeac62f34494`.

GitHub Actions test run `128` completed successfully.

## Precision publication state

The integration is code-complete and CI syntax/tests are passing.

The live GitHub Pages publication is still governed by the existing multi-region deployment gate. Dublin is not allowed to bypass failures in Cork/Kildare or publish a partial regional data build. The Dublin settlement audit itself is also independently validated through the County Dublin coverage workflow.

The mandatory Dublin coverage claim remains:

`complete_boundary_traversal_not_complete_real_world_inventory`

No integration in this phase changes that claim.