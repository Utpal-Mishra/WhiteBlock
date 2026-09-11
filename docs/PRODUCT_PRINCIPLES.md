# WHITEBLOCK Product Principles

These principles guide product, data, modelling and commercial decisions.

## 1. Destination first

WHITEBLOCK starts from the user's trip, not from a list of car parks.

Primary question:

> Where should I park for where I am going, when I will arrive, how long I will stay and what constraints I have?

## 2. Optimise before expanding

Parking pressure does not automatically justify new parking supply.

Evaluate in order:

1. understand demand;
2. improve existing utilisation;
3. redistribute demand;
4. unlock underused/shared supply;
5. use temporary capacity where appropriate;
6. investigate new physical supply only when justified.

## 3. Detection is not permission

Aerial imagery, GIS or behavioural signals can indicate that vehicles use an area.

They cannot, by themselves, establish:

- legal permission;
- public access;
- ownership;
- planning suitability;
- tariff/rules.

Candidate supply remains unverified until separate evidence resolves these questions.

## 4. Predict arrival, not only now

A current vacancy count is useful but incomplete.

The decision engine should evolve toward predicting:

> What is likely to be available when the user reaches the destination?

## 5. Confidence over false certainty

WHITEBLOCK should communicate uncertainty explicitly.

If a rule, capacity estimate or forecast is uncertain, show that uncertainty rather than presenting inference as fact.

## 6. Evidence by default

Important facts and recommendations should carry provenance, freshness and model/rule version information.

The platform should be able to explain why a recommendation was made.

## 7. Accessibility is a first-class use case

Accessible parking is not an optional filter added at the end.

The platform should support accessibility-specific constraints, walking/rolling distance and confidence in accessible-bay information from the data model onward.

## 8. Sustainability matters

WHITEBLOCK should not optimise for maximising parking construction.

Better outcomes can include:

- less cruising/search time;
- better use of existing capacity;
- reduced congestion around full facilities;
- improved Park & Ride utilisation;
- less unnecessary land conversion.

## 9. Privacy by design

Location intelligence should be implemented with data minimisation, consent, aggregation and clear retention rules.

Do not build the product around indefinite storage of identifiable movement histories.

## 10. Open integration before replacement

Initially, WHITEBLOCK should integrate/deep-link to existing payment, reservation and operator systems rather than attempting to replace them.

The first differentiator is the **decision and intelligence layer**.

## 11. Build data assets before expensive infrastructure

Do not begin with proprietary sensors, ANPR or nationwide camera deployment.

First prove value from:

- open/official data;
- operator data;
- licensed imagery;
- public GIS;
- carefully designed modelling.

Physical infrastructure should only be added where its incremental information value is clear.

## 12. Precision before aggressive coverage

Especially for discovered parking candidates, false positives can create legal, safety and trust problems.

A smaller set of high-confidence parking locations is preferable to broad but unreliable coverage.

## 13. Explain recommendations

A ranking should not simply output "Best parking".

It should explain material trade-offs, e.g.:

> Higher expected availability, only two minutes more walking, and lower cost for the planned stay.

## 14. Separate observation from prediction

Never mix measured occupancy and modelled occupancy without clear labels.

Users and operators should be able to tell whether a value is:

- observed;
- reported;
- inferred;
- forecast.

## 15. Expand geographically only after repeatability

Cork is the proving ground.

Expansion should follow once the ingestion, verification, prediction and recommendation process is sufficiently repeatable—not merely once the UI is attractive.
