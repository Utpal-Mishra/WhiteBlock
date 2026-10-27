# Governance / Compliance Log

## GOV-20261003-001 — Imagery licensing and evidence-use boundary

- Date: 2026-10-03
- Scope: cross-region aerial imagery review.
- Governance rule: third-party imagery pixels are review inputs, not repository assets.
- Storage: temporary GitHub Actions artifacts only; permanent repository evidence is metadata/conclusions.
- Attribution: provider/product and available acquisition-date/resolution metadata are retained.
- Data-use boundary: imagery may support physical-supply validation but cannot establish legal/public access, pricing, maximum stay or live occupancy.
- Production preference: use appropriately licensed Irish national orthophotography where available and permitted.
- Status: active control.

## GOV-20261027-003 — Predicted availability must remain distinguishable from observed availability

- Date: 2026-10-27.
- Requirement: Phase 3 baseline outputs are labelled `predicted` and UI copy describes them as historical baselines.
- Current observed free-space evidence remains separate.
- No prediction is used to alter legal/access eligibility.
- No weather/event/traffic claim is made before source and licence review.
- Status: implemented as a Phase 3 guardrail.
## GOV-20261027-004 — Automated imagery processing requires explicit rights record

- Date: 2026-10-27.
- Governance rule: a source contract must record machine_ingestion_allowed=true and an approved machine-analysis licence status before automated detections are accepted.
- Basemap/human-review availability is insufficient evidence of ML-processing rights.
- Candidate access remains unknown/verification-required; public_access_verified=false; recommendation_eligible=false.
- Status: implemented as a fail-closed control.
