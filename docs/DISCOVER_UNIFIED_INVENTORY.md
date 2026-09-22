# Discover Unified Parking Inventory

Status: implemented 2026-09-22.

## Objective

Make WHITEBLOCK Discover independent from whichever region was loaded first in Find, so mapped parking from connected regions can be browsed together.

## Integrated regions

- Cork: Cork City live inventory merged with County Cork mapped inventory by the existing county adapter.
- County Kildare: exact-county mapped parking network.
- County Dublin: exact-boundary mapped parking network across Dublin City, Fingal, Dún Laoghaire–Rathdown and South Dublin.

## Discover aggregation rules

`web/discover.js` now builds a canonical cross-region inventory from `state.regionInventories` instead of freezing the first `parkingData` snapshot.

The aggregation:

1. takes the already-normalized regional adapter records;
2. uses the merged `cork` inventory and deliberately does not add `corkCounty` a second time;
3. adds Kildare and Dublin inventories;
4. de-duplicates by stable asset ID first;
5. uses only a conservative same-name + <=40 metre same-region fallback when an ID duplicate is unavailable;
6. preserves access, pricing, maximum-stay, opening-hours, EV, accessibility, confidence, source and truth-state fields;
7. separates mapped parking from candidate/inferred supply;
8. never promotes unknown access to public parking.

## Dublin behavior

Once `state.regionInventories.dublin` is ready, all normalized Dublin mapped parking assets become part of Discover even when the user is currently viewing Cork or Kildare in Find.

Dublin location cards retain settlement/local-authority context and can navigate back to Find through the asset coordinate. The regional adapter then activates the correct Dublin inventory before selection.

## Scale protection

Discover renders 100 matching records at a time and exposes progressive `Show more` loading. The canonical inventory remains complete in memory; pagination limits only DOM rendering.

This prevents the County Dublin inventory from creating thousands of browser card nodes at once.

## Precision rules

- `mapped` means present in the evidence-backed parking inventory; it does not mean live availability is known.
- `candidate` / `inferred` supply is not displayed as verified parking.
- unknown access remains unknown.
- no fee, maximum stay or opening-hours rule is invented when absent from the source.
- adding an asset to Discover means adding it to the WHITEBLOCK data inventory, not newly constructing or newly discovering physical parking.

## Commits

- `1fdd6c295f5b9723d7adb2fa6358cbe116fa878e` — unified Cork/Kildare/Dublin Discover aggregation.
- `bc9654682c408297f301e0c8371a457a28a04bfd` — regression tests for cross-region aggregation, Dublin inclusion, candidate separation, pagination and access uncertainty.
