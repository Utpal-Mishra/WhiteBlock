# Model / Analytics Log

## MODEL-20261003-001 — Human-reviewed imagery, no automated CV promotion

- Date: 2026-10-03
- Current method: deterministic target selection + human visual review.
- Automated computer vision: not used to promote parking truth in this release.
- Reason: legal/access semantics and ambiguous parking geometry require stronger evidence than a pixel classifier alone.
- Outputs: categorical physical-supply state, geometry follow-up action and reviewer confidence.
- Future model gate: any CV-assisted detector must be benchmarked against labelled Irish parking imagery and remain review-gated until precision/recall and legal-use failure modes are demonstrated.
- Status: manual-review baseline established.
