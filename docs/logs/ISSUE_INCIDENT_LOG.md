# Issue / Incident Log

## INC-20261003-001 — Bray update not visible in deployed app

- Date: 2026-10-03
- Severity: medium.
- Detection: user observed that the Bray update did not appear synchronized with the WHITEBLOCK app.
- Root cause: the implementation had been committed to feature branch `feature/bray-seafront-expansion-2026-10-03` and PR #31, but the PR had not yet been merged into `main`. GitHub Pages deploys from `main`, so the live application correctly continued serving the previous version.
- Evidence:
  - PR #31 was open, mergeable and unmerged when checked.
  - PR tests subsequently completed successfully.
  - previous Pages deployment was based on pre-Bray main commit.
- Corrective action:
  - merged PR #31 using squash merge;
  - resulting main commit: `b9269d82fd7d659a8843f861262f099403cc6b4a`;
  - verified `web/index.html` and `web/bray-adapter.js` on main;
  - confirmed Pages workflow #181 triggered from the merged commit.
- Preventive action:
  - distinguish clearly between "implemented on feature branch", "merged to main", and "deployed live" in future release reporting;
  - do not describe a feature as synced/live until the Pages deployment has completed successfully;
  - include branch, commit and deployment state in release-log entries.
- Status: corrective code merge complete; Pages deployment in progress at time of entry.

## INC-20261003-002 — Kildare snapshot omitted after Overpass timeout

- Date: 2026-10-03
- Detection: latest deployed Pages artifact contained Dublin, Cork and Bray regional snapshots but no Kildare snapshot.
- Root cause: the County Kildare exact-boundary Overpass request timed out/failed across public endpoints and the deployment workflow removed the optional snapshot.
- Corrective action: add bounded exact-boundary refresh, tiled exact-boundary fallback capability, and an explicitly partial Kildare County Council/maintained-anchor snapshot if the full refresh still fails.
- Product control: partial Kildare coverage is visibly labelled and is not described as complete county coverage.
- Status: corrective implementation included in PR #32.
