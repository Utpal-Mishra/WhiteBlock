# Phase 3 — Availability & Demand Intelligence

**Status:** Active — first baseline slice implemented on 2026-10-27.

## Purpose

Phase 3 moves WHITEBLOCK from current/static parking evidence toward time-aware parking intelligence while preserving the evidence and safety rules established in Phases 0–2.

The first production-oriented slice is deliberately conservative:

1. retain repeated official Cork occupancy observations across hourly deployments;
2. deduplicate and bound that history;
3. derive a transparent historical availability baseline;
4. expose arrival-time baseline estimates in the UI when sufficient history exists;
5. keep the experimental forecast out of recommendation ranking until evaluation supports promotion.

## Data path

```text
Cork City official live feed
        ↓
ingest_cork_parking.py
        ↓
current observed parking_observations.jsonl
        ↓
previous published cork_observation_history.jsonl
        ↓
build_cork_availability_baseline.py
        ├── bounded/deduplicated observation history
        └── hierarchical historical baseline
                ↓
web/data/cork_availability_baseline.json
                ↓
availability-intelligence.js
                ↓
arrival-time baseline annotation + Network coverage status
```

## Baseline hierarchy

For a requested future arrival time, the browser selects the most specific historical bucket with enough evidence:

1. same weekday + hour — minimum 2 observations;
2. same hour across recent days — minimum 5 observations;
3. recent overall history — minimum 12 observations.

If none of those gates are met, WHITEBLOCK shows no forecast for that asset.

The baseline exposes:

- mean historically available spaces;
- mean occupancy ratio;
- empirical probability that at least one space was available;
- sample count;
- first/last supporting observation;
- model version and method.

## Critical guardrails

- Truth state is `predicted`, never `observed`.
- Current observed availability remains separate and visible.
- The baseline does not create parking assets or alter access/rule eligibility.
- The baseline is not used in recommendation ranking yet.
- Missing history produces “unavailable/collecting history,” not synthetic values.
- History retention is bounded to 90 days by default.
- Local time bucketing uses `Europe/Dublin`.
- No weather, event or traffic feature is claimed until those sources are explicitly integrated and evaluated.

## Why ranking remains disabled

Phase 3's exit condition requires measurable improvement over simple baselines and monitoring of error/calibration. A historical mean is the benchmark that later models must beat, not sufficient evidence by itself to change driver recommendations.

Promotion into ranking requires, at minimum:

- enough ground-truth history;
- holdout/backtest evaluation;
- MAE/RMSE where space counts exist;
- probability calibration review;
- segment-level error checks by asset/time;
- degradation/drift monitoring;
- a documented decision threshold for fallback to current-only evidence.

## Next Phase 3 increments

- persist a sufficient observation window through scheduled deployments;
- add baseline evaluation/backtesting;
- add ETA-aligned prediction records using the existing parking-observation schema;
- compare historical mean vs simple time-series/ML models where data density supports it;
- experiment with event/weather/traffic features as separately sourced evidence;
- only then allow validated forecasts to influence Best Overall ranking.

Phase 1.5 coverage/reconciliation continues in parallel and is not reclassified as Phase 3 work.
