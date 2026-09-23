# County Dublin Parking Access Layer

## Purpose

The County Dublin inventory is a mapped/evidence inventory, not a statement that every mapped parking asset is usable by every driver. WHITEBLOCK therefore separates **mapped supply** from **usable supply** before recommendation.

Mandatory principle:

> Available/mapped parking is not automatically suitable or legally usable parking.

The access layer never promotes missing access evidence to public parking.

## Access taxonomy

The browser presents five evidence groups:

| WHITEBLOCK group | Source values | Recommendation treatment |
| --- | --- | --- |
| Public | `public` | Eligible, subject to session rules |
| Customer / destination | `customer`, `destination` | Conditional; ranked below verified public access and labelled clearly |
| Permissive | `permissive` | Conditional; may be locally restricted or withdrawn |
| Restricted | `private`, `permit`, `restricted`, `emergency`, `residents;visitors` | Excluded from normal recommendations; retained in evidence/network inventory |
| Unknown | `unknown`, `designated`, unrecognised values | Not assumed public; retained with uncertainty penalty |

`designated` is intentionally kept in **Unknown** because that tag alone does not establish general public eligibility.

## Validated Dublin snapshot baseline

The access presentation was implemented against the validated **9,005-asset** County Dublin snapshot published on 2026-09-23.

Raw access values in that snapshot:

- `unknown`: 4,442
- `private`: 2,766
- `customer`: 928
- `public`: 518
- `permissive`: 221
- `permit`: 90
- `destination`: 22
- `restricted`: 14
- `residents;visitors`: 2
- `emergency`: 1
- `designated`: 1

WHITEBLOCK presentation groups for that same snapshot:

- **Public:** 518
- **Customer / destination:** 950
- **Permissive:** 221
- **Restricted:** 2,873
- **Unknown:** 4,443
- **Total:** 9,005

These counts describe the validated snapshot only. They are expected to change as source data and evidence improve.

## Driver-map behaviour

The all-inventory clustered map now has an access-layer control.

Default visible groups:

- Public
- Customer / destination
- Permissive
- Unknown

Restricted parking is hidden by default to reduce driver-facing noise but remains available through **Show all** for network/evidence inspection.

The map marker semantics are:

- `P` = public
- `C` = customer/destination condition
- `~` = permissive/conditional
- `?` = access not verified
- `×` = restricted/private/permit

EV and accessible capability indicators remain secondary badges. Access eligibility is the primary marker meaning because it determines whether a driver may actually use the asset.

## Recommendation behaviour

Access evidence is applied before or during ranking:

1. Restricted/private/permit/emergency/resident-only assets are removed from normal recommendation candidates.
2. Customer/destination parking remains conditional and is penalised below explicit public access.
3. Permissive parking remains conditional and is penalised below explicit public access.
4. Unknown-access parking stays eligible for research/driver visibility but receives an uncertainty penalty; it is never labelled public.
5. Existing max-stay and opening-hour rules continue to hard-exclude assets that cannot fit the requested session.

This means a nearby private car park cannot win the **Closest** or **Lowest cost** recommendation merely because it is geographically close or has a low/unknown price.

## Evidence UI

The Evidence view now receives a live Dublin access summary calculated from the loaded Dublin inventory. It shows counts for all five groups and reiterates that restricted assets are retained for network transparency while unknown access is not promoted to public access.

## Files

- `web/parking-access-layer.js` — taxonomy, recommendation wrappers, map filters, marker semantics, evidence summary
- `web/parking-access-layer.css` — access marker styles, map access control, result warnings, evidence cards
- `web/index.html` — loads the access layer after session eligibility rules
- `tests/test_parking_access_layer.py` — taxonomy and runtime contract tests
- `.github/workflows/test.yml` — JavaScript syntax gate

## Next evidence-enrichment queue

The next material gain will come from reducing the **Unknown** group rather than adding more generic mapped points. Priority should be:

1. high-volume unknown-access settlements;
2. retail/supermarket customer parking with store-specific opening/max-stay evidence;
3. official local-authority public car parks and regulated street-parking reconciliation;
4. tariffs, capacity, accessible spaces, EV spaces, max stay and opening hours;
5. operator or venue evidence where OSM access tags are missing or ambiguous.

Every promotion from Unknown to Public/Customer/Restricted must retain source, observation date/freshness and confidence. Satellite/aerial imagery may identify a candidate parking area but cannot establish public/legal access on its own.
