# Automation Log

## AUTO-20261003-001 — Bray refresh remains manual/curated

- Date: 2026-10-03
- Current automation: none for Bray evidence ingestion.
- Reason: sources span council rules, mapped parking records, secondary listings and imagery; automatic promotion could create false legal/public assertions.
- Current method: curated snapshot with explicit provenance and confidence.
- Automation candidate: scheduled source-refresh job that stages changes, hashes evidence, flags changed rules/coordinates/capacity and requires reconciliation before promotion.
- Trigger to automate: stable source contracts plus repeatable validation tests.
- Risk control: do not automate imagery-to-public-parking promotion.
- Status: backlog.
