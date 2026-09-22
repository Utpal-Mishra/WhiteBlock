// WHITEBLOCK Kildare asset attribute bridge.
// Region-network hydrates a compact browser model. This layer restores the
// evidence-backed access/type/accessibility/EV fields needed by filters and
// session rules without changing the source snapshot.

(() => {
  if (typeof state === "undefined") return;

  function rawById() {
    const locations = state.regionSnapshots?.kildare?.locations;
    if (!Array.isArray(locations)) return new Map();
    return new Map(locations.filter(item => item?.parking_id).map(item => [item.parking_id, item]));
  }

  function enrichItem(item, raw) {
    if (!item || !raw) return item;
    const clone = { ...item };
    clone.parkingType = raw.parking_type || clone.parkingType || null;
    clone.accessType = raw.access_type || clone.accessType || "unknown";
    clone.maxStayMinutes = raw.maximum_stay_minutes ?? clone.maxStayMinutes ?? null;
    clone.openingHoursRaw = raw.opening_hours_raw || clone.openingHoursRaw || null;
    clone.heightRestrictionRaw = raw.height_restriction_raw || clone.heightRestrictionRaw || null;
    clone.accessibleSpaces = raw.accessible_spaces ?? clone.accessibleSpaces ?? null;
    clone.accessible = raw.accessibility_available === true || Number(raw.accessible_spaces || 0) > 0 || clone.accessible === true;
    clone.evSpaces = raw.ev_spaces ?? clone.evSpaces ?? null;
    clone.ev = Number(raw.ev_spaces || 0) > 0 || clone.ev === true;
    clone.pricingRaw = raw.pricing_raw || clone.pricingRaw || null;
    clone.evidenceNote = raw.evidence_note || clone.evidenceNote || null;
    clone.accessibilityNote = raw.accessibility_note || clone.accessibilityNote || null;
    clone.evNote = raw.ev_note || clone.evNote || null;
    clone.geometrySourceUrl = raw.geometry_source_url || clone.geometrySourceUrl || null;
    clone.pricingSourceUrl = raw.pricing_source_url || clone.pricingSourceUrl || null;
    return clone;
  }

  function applyEnrichment() {
    const lookup = rawById();
    if (!lookup.size || !Array.isArray(state.regionInventories?.kildare)) return false;

    state.regionInventories.kildare = state.regionInventories.kildare.map(item => enrichItem(item, lookup.get(item.id)));

    if (state.activeRegion === "kildare") {
      parkingData = state.regionInventories.kildare.map(item => ({ ...item }));
      if (typeof renderParkingList === "function") renderParkingList();
      if (state.destination && typeof applyDestinationContext === "function") {
        window.setTimeout(() => applyDestinationContext({ runRanking: false }), 0);
      }
    }

    document.dispatchEvent(new CustomEvent("whiteblock:kildare-attributes-ready", {
      detail: {
        count: state.regionInventories.kildare.length,
        evLocations: state.regionInventories.kildare.filter(item => item.ev === true).length,
        accessibleLocations: state.regionInventories.kildare.filter(item => item.accessible === true).length
      }
    }));
    return true;
  }

  let attempts = 0;
  const tryApply = () => {
    attempts += 1;
    if (applyEnrichment() || attempts >= 20) return;
    window.setTimeout(tryApply, 250);
  };

  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(applyEnrichment, 0));
  tryApply();
})();

// Destination search should reveal the mapped parking supply around the chosen
// place. Keep this as a separate layer so the same behaviour can be reused by
// Cork, Kildare, Dublin and future regional adapters.
(() => {
  if (document.querySelector('script[data-whiteblock-destination-parking-focus]')) return;
  const script = document.createElement('script');
  script.src = './destination-parking-focus.js?v=20260922-1';
  script.defer = true;
  script.dataset.whiteblockDestinationParkingFocus = 'true';
  document.body.appendChild(script);
})();
