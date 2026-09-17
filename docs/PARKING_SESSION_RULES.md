# Parking Session Rules

WHITEBLOCK applies parking restrictions before recommendation ranking. Availability, price or proximity must not make an option recommendable when the requested session conflicts with a known rule.

## Eligibility order

1. Determine the user's requested arrival time and stay duration.
2. Exclude private, permit-only and restricted parking from normal recommendations.
3. Compare the requested duration with `maximum_stay_minutes` when that field is known.
4. Check the requested session against opening/access hours only when the published hours can be interpreted without ambiguity.
5. Keep customer parking conditionally eligible, clearly labelled `Customers only`, and rank it below a comparable public option.
6. Rank only session-eligible assets using availability, distance, evidence confidence, price and restriction risk.
7. Preserve excluded nearby assets in the collapsed **Not suitable for this stay** section so the user can see why they were not recommended.

## Maximum stay behavior

For a parking asset with `maximum_stay_minutes = 120`:

- 60 minutes: eligible.
- 105 minutes: eligible.
- 115 minutes: eligible but labelled **Near stay limit**.
- 120 minutes: eligible but labelled **Near stay limit** and receives a ranking penalty because there is no buffer.
- More than 120 minutes: excluded from normal recommendations and labelled **Does not fit your stay**.

The near-limit buffer is deliberately conservative: 10% of the maximum stay, bounded between 10 and 15 minutes.

## Customer / retail parking

Retail parking is not treated as general free public parking. Use `access_type = customer` for supermarket, grocery, shopping-centre or similar parking that is intended for customers.

The UI must show:

- `Customers only`;
- maximum stay where known;
- opening/access window where safely machine-readable;
- a warning that on-site signage and operator rules remain authoritative.

Customer parking remains a possible option for a user who can legitimately use it, but receives a ranking penalty compared with otherwise similar public parking.

## Opening hours

`opening_hours_raw` remains the evidence field. The browser enforces opening hours only for unambiguous patterns such as:

- `24/7`;
- `24 hours`;
- `Daily 08:00-22:00`;
- `Mon-Sun 08:00-22:00`;
- `Mo-Su 08:00-22:00`.

Day-specific or multi-window schedules are not guessed. They remain visible as published rules until a structured rules parser/source is introduced.

## Data flow

```text
Parking source / operator / verified signage
              ↓
parking_location.maximum_stay_minutes
parking_location.opening_hours_raw
parking_location.access_type
              ↓
PostGIS API or Pages snapshot
              ↓
Parking session eligibility
              ↓
Eligible recommendations
+ transparent excluded options
```

## Principle

**Eligibility first → availability → restriction risk → distance → cost → evidence confidence.**

A lower price or shorter walk must never override a known invalid maximum-stay or access rule.
