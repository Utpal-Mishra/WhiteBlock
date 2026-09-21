// WHITEBLOCK County Cork network adapter.
// Extends the Cork City live pilot to county-wide mapped parking coverage while
// keeping live availability claims limited to the authoritative city feed.

(() => {
  if (typeof state === "undefined" || typeof haversineKm !== "function") return;
  if (window.__WHITEBLOCK_CORK_COUNTY_NETWORK__) return;
  window.__WHITEBLOCK_CORK_COUNTY_NETWORK__ = true;

  const SNAPSHOT_URL = "./data/cork_county_parking_snapshot.json";
  const CORK_COUNTY_BOUNDS = { south: 51.40, west: -10.72, north: 52.40, east: -7.72 };
  const cityPilotCheck = isInCorkPilot;
  window.WHITEBLOCK_CORK_CITY_PILOT_FN = cityPilotCheck;

  const hubs = [
    { name: "Cork City", lat: 51.8985, lng: -8.4756 },
    { name: "Mallow", lat: 52.1330, lng: -8.6339 },
    { name: "Fermoy", lat: 52.1358, lng: -8.2752 },
    { name: "Mitchelstown", lat: 52.2658, lng: -8.2681 },
    { name: "Charleville", lat: 52.3557, lng: -8.6840 },
    { name: "Macroom", lat: 51.9044, lng: -8.9594 },
    { name: "Bandon", lat: 51.7469, lng: -8.7425 },
    { name: "Kinsale", lat: 51.7059, lng: -8.5222 },
    { name: "Carrigaline", lat: 51.8115, lng: -8.3986 },
    { name: "Cobh", lat: 51.8515, lng: -8.2943 },
    { name: "Midleton", lat: 51.9153, lng: -8.1753 },
    { name: "Youghal", lat: 51.9517, lng: -7.8456 },
    { name: "Clonakilty", lat: 51.6227, lng: -8.8861 },
    { name: "Skibbereen", lat: 51.5500, lng: -9.2667 },
    { name: "Bantry", lat: 51.6801, lng: -9.4520 },
    { name: "Dunmanway", lat: 51.7210, lng: -9.1121 },
    { name: "Millstreet", lat: 52.0597, lng: -9.0608 },
    { name: "Kanturk", lat: 52.1767, lng: -8.9000 },
    { name: "Castletownbere", lat: 51.6510, lng: -9.9090 },
    { name: "Schull", lat: 51.5260, lng: -9.5480 }
  ];

  const otherCountyPattern = /county\s+(kerry|limerick|tipperary|waterford|kildare|clare)|\b(kerry|limerick|tipperary|waterford|kildare|clare)\b/i;
  const corkTextPattern = /county\s+cork|co\.?\s*cork|\bcork\b/i;

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.corkCountyNetworkStatus = "loading";
  state.corkCountyCoverageLayer = null;

  function destinationText() {
    const d = state.destination || {};
    return [d.primary, d.secondary, d.label].filter(Boolean).join(" ");
  }

  function insideBounds(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= CORK_COUNTY_BOUNDS.south && lat <= CORK_COUNTY_BOUNDS.north
      && lng >= CORK_COUNTY_BOUNDS.west && lng <= CORK_COUNTY_BOUNDS.east;
  }

  function nearestHubDistance(lat, lng) {
    return hubs.reduce((best, hub) => Math.min(best, haversineKm(lat, lng, hub.lat, hub.lng)), Infinity);
  }

  function isInCorkCountyCoverage(lat, lng) {
    if (cityPilotCheck(lat, lng)) return true;
    const text = destinationText();
    if (otherCountyPattern.test(text) && !corkTextPattern.test(text)) return false;
    if (corkTextPattern.test(text) && insideBounds(lat, lng)) return true;
    return insideBounds(lat, lng) && nearestHubDistance(lat, lng) <= 38;
  }

  // The existing application uses isInCorkPilot as a generic connected-coverage
  // gate. Widen it before region-network.js captures the function.
  isInCorkPilot = function isInCorkConnectedCoverage(lat, lng) {
    return isInCorkCountyCoverage(lat, lng);
  };

  function priceNumber(raw) {
    if (!raw) return null;
    const match = String(raw).match(/€\s*([0-9]+(?:[.,][0-9]+)?)/i);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function hydrate(record) {
    return {
      id: record.parking_id,
      name: record.name || record.parking_id,
      area: record.area || "County Cork",
      lat: Number(record.latitude),
      lng: Number(record.longitude),
      geometry: record.geometry || null,
      geometryTruthState: record.geometry_truth_state || null,
      available: null,
      capacity: Number.isFinite(Number(record.capacity)) ? Number(record.capacity) : null,
      occupancyRatio: null,
      confidence: Math.round(Number(record?.confidence?.score ?? 0.7) * 100),
      confidenceBasis: record?.confidence?.basis || {},
      accessible: Number(record.accessible_spaces || 0) > 0 ? true : null,
      ev: Number(record.ev_spaces || 0) > 0 ? true : null,
      pricingRaw: record.pricing_raw || null,
      openingHoursRaw: record.opening_hours_raw || null,
      heightRestrictionRaw: record.height_restriction_raw || null,
      observedAt: record.observed_at || null,
      retrievedAt: record.retrieved_at || null,
      truthState: record.truth_state || "observed",
      sourceKey: record.source_key || "openstreetmap_cork_county_parking",
      sourceUrl: record.source_url || null,
      networkRole: record.network_role || "parking_asset",
      parkingType: record.parking_type || "parking",
      accessType: record.access_type || "unknown",
      distanceKm: null,
      walk: null,
      price: priceNumber(record.pricing_raw),
      reason: "Mapped County Cork parking inventory. Live occupancy is only claimed where a verified live feed is connected."
    };
  }

  function normalizedName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function likelySameAsset(a, b) {
    if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lng) || !Number.isFinite(b?.lat) || !Number.isFinite(b?.lng)) return false;
    if (haversineKm(a.lat, a.lng, b.lat, b.lng) > 0.09) return false;
    const aa = normalizedName(a.name);
    const bb = normalizedName(b.name);
    if (!aa || !bb) return true;
    return aa.includes(bb) || bb.includes(aa) || aa.split(" ").some(token => token.length > 4 && bb.includes(token));
  }

  function mergeInventories(cityItems, countyItems) {
    const merged = (cityItems || []).map(item => ({ ...item, coverageScope: "cork_city_live" }));
    (countyItems || []).forEach(item => {
      if (merged.some(existing => likelySameAsset(existing, item))) return;
      merged.push({ ...item, coverageScope: "cork_county_network" });
    });
    return merged;
  }

  function nearbyCounty() {
    const inventory = state.regionInventories.cork || [];
    if (!state.destination) return inventory;
    return inventory.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng)
      && haversineKm(state.destination.lat, state.destination.lng, item.lat, item.lng) <= 12);
  }

  const baseSetKpiMode = setKpiMode;
  setKpiMode = function setCountyAwareKpis(inConnectedRegion) {
    const d = state.destination;
    if (!d || cityPilotCheck(d.lat, d.lng) || !isInCorkCountyCoverage(d.lat, d.lng)) {
      return baseSetKpiMode(inConnectedRegion);
    }

    const nearby = nearbyCounty();
    const confidences = nearby.map(item => item.confidence).filter(Number.isFinite);
    const knownCapacity = nearby.reduce((sum, item) => sum + (item.capacity || 0), 0);
    const values = {
      coverage: [String(nearby.length), "mapped County Cork parking assets within 12 km"],
      availability: ["—", "county-wide live occupancy not connected"],
      confidence: [confidences.length ? `${Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)}%` : "—", "source + freshness + completeness"],
      pressure: ["Network", knownCapacity ? `${knownCapacity} known spaces across nearby mapped assets` : "inventory coverage · pressure not inferred"]
    };
    [["coverage", values.coverage], ["availability", values.availability], ["confidence", values.confidence], ["pressure", values.pressure]].forEach(([key, value]) => {
      const valueEl = document.getElementById(`kpi-${key}-value`);
      const copyEl = document.getElementById(`kpi-${key}-copy`);
      if (valueEl) valueEl.textContent = value[0];
      if (copyEl) copyEl.textContent = value[1];
    });
  };

  function nearestHub(item) {
    let winner = null;
    let best = Infinity;
    hubs.forEach(hub => {
      const distance = haversineKm(item.lat, item.lng, hub.lat, hub.lng);
      if (distance < best) { best = distance; winner = hub; }
    });
    return winner && best <= 30 ? winner.name : "Other County Cork";
  }

  function clusterCounts() {
    const counts = new Map(hubs.map(hub => [hub.name, 0]));
    counts.set("Other County Cork", 0);
    (state.regionInventories.corkCounty || []).forEach(item => {
      const hub = nearestHub(item);
      counts.set(hub, (counts.get(hub) || 0) + 1);
    });
    return counts;
  }

  function updateNetworkPanel() {
    const host = document.getElementById("view-network");
    if (!host) return;
    let panel = document.getElementById("cork-county-network-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "cork-county-network-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      const grid = host.querySelector(".network-grid");
      host.insertBefore(panel, grid || null);
    }
    const snapshot = state.regionSnapshots.corkCounty;
    const counts = clusterCounts();
    const total = snapshot?.summary?.locations ?? state.regionInventories.corkCounty?.length ?? 0;
    const polygons = snapshot?.summary?.mapped_polygon_locations ?? 0;
    const chips = hubs.map(hub => `<button type="button" data-cork-county-hub="${escapeHtml(hub.name)}" style="border:1px solid rgba(120,230,170,.18);background:#0b1712;color:#edf7f1;border-radius:999px;padding:7px 10px;font:600 11px 'DM Sans';">${escapeHtml(hub.name)} · ${counts.get(hub.name) || 0}</button>`).join("");
    panel.innerHTML = `
      <p class="eyebrow">Cork county network</p>
      <h3 style="margin:5px 0 6px">${total || "Loading"} mapped parking locations across County Cork</h3>
      <p style="margin:0;color:#8fa39a;font-size:12px;line-height:1.5">Cork City keeps its live council feed; county coverage uses mapped inventory without fabricated occupancy. ${polygons ? `${polygons} records include mapped parking-area geometry.` : "Parking-area geometry is loading."}</p>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px">${chips}</div>`;
    panel.querySelectorAll("[data-cork-county-hub]").forEach(button => {
      button.addEventListener("click", () => {
        const hub = hubs.find(item => item.name === button.dataset.corkCountyHub);
        if (!hub) return;
        selectAddressSuggestion({
          primary: hub.name,
          secondary: "County Cork, Ireland",
          label: `${hub.name}, County Cork, Ireland`,
          lat: hub.lat,
          lng: hub.lng,
          type: "town",
          source: "WHITEBLOCK Cork County network hub"
        }, { runRanking: true });
        setView("find");
      });
    });
  }

  function registerCoverageAndFallbacks() {
    const corkCoverage = coverageAreas.find(area => area.name === "Cork");
    if (corkCoverage) corkCoverage.label = "City live + county parking network";
    hubs.forEach(hub => {
      if (fallbackPlaces.some(place => place.primary === hub.name && String(place.secondary).includes("Cork"))) return;
      fallbackPlaces.push({
        primary: hub.name,
        secondary: "County Cork, Ireland",
        label: `${hub.name}, County Cork, Ireland`,
        lat: hub.lat,
        lng: hub.lng,
        type: "town",
        source: "WHITEBLOCK Cork County fallback"
      });
    });
  }

  function clearCoverageOverlay() {
    if (state.map && state.corkCountyCoverageLayer) {
      state.map.removeLayer(state.corkCountyCoverageLayer);
      state.corkCountyCoverageLayer = null;
    }
  }

  function renderCoverageOverlay() {
    if (!state.map || typeof L === "undefined") return;
    clearCoverageOverlay();
    state.corkCountyCoverageLayer = L.layerGroup().addTo(state.map);
    const counts = clusterCounts();
    hubs.forEach(hub => {
      L.circleMarker([hub.lat, hub.lng], {
        radius: hub.name === "Cork City" ? 6 : 4.5,
        color: "#78E6AA",
        weight: 1.5,
        fillColor: "#07110D",
        fillOpacity: 1
      }).bindTooltip(`${hub.name} · ${counts.get(hub.name) || 0} county inventory assets`, { direction: "top" }).addTo(state.corkCountyCoverageLayer);
    });
  }

  async function loadSnapshot() {
    try {
      const response = await fetch(`${SNAPSHOT_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`County Cork snapshot returned ${response.status}`);
      const snapshot = await response.json();
      if (!Array.isArray(snapshot.locations) || !snapshot.locations.length) throw new Error("County Cork snapshot contains no parking locations");
      const county = snapshot.locations.map(hydrate).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      state.regionSnapshots.corkCounty = snapshot;
      state.regionInventories.corkCounty = county;
      const city = Array.isArray(state.regionInventories.cork) ? state.regionInventories.cork : (Array.isArray(parkingData) ? parkingData : []);
      state.regionInventories.cork = mergeInventories(city, county);
      state.corkCountyNetworkStatus = "ready";
      updateNetworkPanel();

      if (state.destination && isInCorkCountyCoverage(state.destination.lat, state.destination.lng)) {
        parkingData = state.regionInventories.cork.map(item => ({ ...item }));
        state.selectedId = parkingData[0]?.id || null;
        document.dispatchEvent(new CustomEvent("whiteblock:data-ready", { detail: { region: "cork", source: "cork-county-network" } }));
        window.setTimeout(() => {
          try { applyDestinationContext({ runRanking: true }); } catch (_) {}
        }, 30);
      }
    } catch (error) {
      console.error("WHITEBLOCK County Cork network unavailable", error);
      state.corkCountyNetworkStatus = "error";
      updateNetworkPanel();
    }
  }

  document.getElementById("ireland-overview-button")?.addEventListener("click", () => window.setTimeout(renderCoverageOverlay, 100));
  registerCoverageAndFallbacks();
  updateNetworkPanel();
  void loadSnapshot();
})();
