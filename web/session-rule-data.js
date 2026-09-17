// Carry structured parking restrictions from the published snapshot into the
// browser parking objects used by the recommendation/session-rule engine.

(() => {
  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function hydrateRuleFields() {
    const locations = state.parkingSnapshot?.locations;
    if (!Array.isArray(locations) || !locations.length || !Array.isArray(parkingData)) return false;

    const byId = new Map(locations.map(record => [record.parking_id, record]));
    let changed = false;
    parkingData.forEach(item => {
      const source = byId.get(item.id);
      if (!source) return;
      item.accessType = source.access_type || item.accessType || "unknown";
      item.parkingType = source.parking_type || item.parkingType || "unknown";
      item.maxStayMinutes = numeric(source.maximum_stay_minutes);
      item.openingHoursRaw = source.opening_hours_raw || item.openingHoursRaw || null;
      changed = true;
    });
    return changed;
  }

  function hydrateAndRefresh(event) {
    if (event?.detail?.mode === "api") return;
    if (hydrateRuleFields()) window.WBSessionRules?.refresh?.();
  }

  document.addEventListener("whiteblock:data-ready", hydrateAndRefresh);
  hydrateAndRefresh();
})();
