# Model / Analytics Log

## MODEL-20261003-001 — Human-reviewed imagery, no automated CV promotion

- Date: 2026-10-03
- Current method: deterministic target selection + human visual review.
- Automated computer vision: not used to promote parking truth in this release.
- Reason: legal/access semantics and ambiguous parking geometry require stronger evidence than a pixel classifier alone.
- Outputs: categorical physical-supply state, geometry follow-up action and reviewer confidence.
- Future model gate: any CV-assisted detector must be benchmarked against labelled Irish parking imagery and remain review-gated until precision/recall and legal-use failure modes are demonstrated.
- Status: manual-review baseline established.

## MODEL-20261027-003 — Hierarchical historical-mean availability baseline v1

- Date: 2026-10-27.
- Model: `phase3-naive-v1` / hierarchical historical mean.
- Hierarchy: weekday+hour (>=2 samples) -> hour across days (>=5) -> overall recent history (>=12).
- Outputs per bucket: sample count, mean available spaces, mean occupancy ratio, empirical probability of any space, mean capacity, first/last supporting timestamps.
- Timezone: Europe/Dublin.
- Classification: benchmark / naive baseline, not a validated ML model.
- Ranking use: disabled.
- Status: implemented; evaluation pending.
