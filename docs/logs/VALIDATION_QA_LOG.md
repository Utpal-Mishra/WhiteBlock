# Validation / QA Log

## QA-20261003-001 — Bray implementation checks

- Date: 2026-10-03
- Static validation targets:
  - JSON snapshot parses successfully.
  - Bray adapter loads after api-adapter.js.
  - Cork API gate remains Cork-only.
  - Bray coverage gate is available to later UI layers.
  - duplicate Bray IDs are not introduced on repeated data-ready events.
  - unknown availability remains null and renders as unknown.
  - access_type=unknown is not converted to public.
- Functional checks pending after branch deployment:
  - search Bray Seafront;
  - verify seven mapped assets appear;
  - verify Cork results still work;
  - verify Ireland overview shows Bray;
  - verify mobile layout and map layers;
  - verify no console error if Bray snapshot fails.
- Status: static design checks completed; browser/deployment regression pending.
