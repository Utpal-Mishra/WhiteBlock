// WHITEBLOCK multi-region adapter: Cork live pilot + County Kildare network inventory.
// Kildare inventory is evidence-backed but intentionally does not claim live occupancy.

(() => {
  if (typeof state === "undefined" || typeof haversineKm !== "function") return;

  const SNAPSHOT_URL = "./data/kildare_parking_snapshot.json";
  const WB_KILDARE_BOUNDS = {
    south: 52.89292777262258,
    west: -7.094685794312817,
    north: 53.40546821613401,
    east: -6.4849660938960625
  };

  const hubs = [
    { name: "Naas", lat: 53.2158, lng: -6.6669 },
    { name: "Newbridge", lat: 53.1815, lng: -6.7966 },
    { name: "Kildare Town", lat: 53.1589, lng: -6.9096 },
    { name: "Athy", lat: 52.9916, lng: -6.9856 },
    { name: "Maynooth", lat: 53.3813, lng: -6.5927 },
    { name: "Celbridge", lat: 53.3386, lng: -6.5436 },
    { name: "Leixlip", lat: 53.3659, lng: -6.4953 },
    { name: "Clane", lat: 53.2917, lng: -6.6892 },
    { name: "Kilcock", lat: 53.3990, lng: -6.6696 },
    { name: "Sallins", lat: 53.2488, lng: -6.6646 },
    { name: "Kilcullen", lat: 53.1301, lng: -6.7443 }
  ];

  const hubEdges = [
    ["Naas", "Newbridge"], ["Newbridge", "Kildare Town"], ["Kildare Town", "Athy"],
    ["Naas", "Sallins"], ["Sallins", "Clane"], ["Clane", "Maynooth"],
    ["Maynooth", "Celbridge"], ["Celbridge", "Leixlip"], ["Clane", "Kilcock"],
    ["Newbridge", "Kilcullen"]
  ];

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.activeRegion = state.activeRegion || "cork";
  state.kildareNetworkStatus = "loading";
  state.kildareCoverageLayer = null;

  const originalIsInCorkPilot = isInCorkPilot;
  const originalApplyDestinationContext = applyDestinationContext;
  const originalSetKpiMode = setKpiMode;

  function isInKildareCoverage(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= WB_KILDARE_BOUNDS.south && lat <= WB_KILDARE_BOUNDS.north
      && lng >= WB_KILDARE_BOUNDS.west && lng <= WB_KILDARE_BOUNDS.east;
  }

  function resolveRegion(lat, lng) {
    if (originalIsInCorkPilot(lat, lng)) return "cork";
    if (isInKildareCoverage(lat, lng)) return "kildare";
    return null;
  }

  // Existing application code uses this gate for "supported parking intelligence".
  // Preserve the identifier for compatibility while widening its semantics to all connected regions.
  isInCorkPilot = function isInConnectedRegion(lat, lng) {
    return resolveRegion(lat, lng) !== null;
  };

  function priceNumber(raw) {
    if (!raw) return null;
    const match = String(raw).match(/€\s*([0-9]+(?:[.,][0-9]+)?)/i);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function hydrateKildare(record) {
    return {
      id: record.parking_id,
      name: record.name || record.parking_id,
      area: record.area || "County Kildare",
      lat: Number(record.latitude),
      lng: Number(record.longitude),
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
      sourceKey: record.source_key || "kildare_network",
      sourceUrl: record.source_url || null,
      networkRole: record.network_role || "parking_asset",
      distanceKm: null,
      walk: null,
      price: priceNumber(record.pricing_raw),
      reason: record.network_role === "accessible_space"
        ? "Official Kildare accessible-parking location. Live occupancy is not published by this source."
        : "Mapped Kildare parking inventory. Live occupancy is not currently published for this asset."
    };
  }

  function captureCorkInventory() {
    const region = String(state.parkingSnapshot?.coverage?.region || "").toLowerCase();
    if (region && region !== "cork") return;
    if (Array.isArray(parkingData) && parkingData.length) {
      state.regionInventories.cork = parkingData.map(item => ({ ...item }));
      state.regionSnapshots.cork = state.parkingSnapshot;
    }
  }

  function clearRegionMarkers() {
    if (!state.map) return;
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers.clear();
  }

  function rebuildRegionMarkers() {
    if (!state.map || typeof L === "undefined") return;
    clearRegionMarkers();
    parkingData.forEach(item => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const icon = L.divIcon({
        className: "wb-marker-wrapper",
        html: markerHtml(item),
        iconSize: [34, 34],
        iconAnchor: [17, 30]
      });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(state.map);
      const availability = item.available != null
        ? `${Math.round(item.available)} spaces reported free`
        : (state.activeRegion === "kildare" ? "inventory location · live availability not connected" : "availability unknown");
      marker.bindTooltip(`${item.name} · ${availability}`, { direction: "top", offset: [0, -22], className: "wb-tooltip" });
      marker.on("click", () => selectParking(item.id));
      state.markers.set(item.id, marker);
    });
  }

  function updateRegionChrome(region) {
    const eyebrow = document.querySelector(".topbar .eyebrow");
    if (eyebrow) {
      eyebrow.textContent = region === "kildare"
        ? "Ireland · Kildare parking network"
        : region === "cork"
          ? "Ireland · Cork intelligence pilot"
          : "Ireland · destination search";
    }

    if (region === "kildare") {
      setMapStatus("Kildare parking network", "Council + OpenStreetMap inventory · live availability not connected");
    } else if (region === "cork") {
      setMapStatus("Cork official parking data", "Official parking snapshot ranked for this destination");
    }
  }

  function activateRegion(region, { notify = true } = {}) {
    state.activeRegion = region;

    if (region === "kildare") {
      const inventory = state.regionInventories.kildare || [];
      parkingData = inventory.map(item => ({ ...item }));
      state.parkingSnapshot = state.regionSnapshots.kildare || null;
      state.dataStatus = state.kildareNetworkStatus === "ready" ? "ready" : "loading";
    } else if (region === "cork") {
      const inventory = state.regionInventories.cork || [];
      parkingData = inventory.map(item => ({ ...item }));
      state.parkingSnapshot = state.regionSnapshots.cork || state.parkingSnapshot;
      state.dataStatus = inventory.length ? "ready" : state.dataStatus;
    } else {
      parkingData = [];
      state.dataStatus = "ready";
    }

    state.selectedId = parkingData[0]?.id || null;
    rebuildRegionMarkers();
    updateRegionChrome(region);
    updateNetworkPanel();

    if (notify) {
      document.dispatchEvent(new CustomEvent("whiteblock:data-ready", {
        detail: { region: region || "unsupported", source: "region-network" }
      }));
    }
  }

  function nearbyKildare() {
    if (!state.destination) return parkingData;
    return parkingData.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng)
      && haversineKm(state.destination.lat, state.destination.lng, item.lat, item.lng) <= 10);
  }

  setKpiMode = function setMultiRegionKpis(inConnectedRegion) {
    if (state.activeRegion !== "kildare") {
      return originalSetKpiMode(inConnectedRegion);
    }

    const nearby = nearbyKildare();
    const confidences = nearby.map(item => item.confidence).filter(Number.isFinite);
    const knownCapacity = nearby.reduce((sum, item) => sum + (item.capacity || 0), 0);
    const values = {
      coverage: [String(nearby.length), "mapped Kildare parking assets within 10 km"],
      availability: ["—", "no live occupancy feed connected for Kildare"],
      confidence: [confidences.length ? `${Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)}%` : "—", "source + freshness + completeness"],
      pressure: ["Network", knownCapacity ? `${knownCapacity} known spaces across nearby mapped assets` : "inventory coverage · pressure not inferred"]
    };

    [["coverage", values.coverage], ["availability", values.availability], ["confidence", values.confidence], ["pressure", values.pressure]].forEach(([key, value]) => {
      const valueEl = document.getElementById(`kpi-${key}-value`);
      const copyEl = document.getElementById(`kpi-${key}-copy`);
      if (valueEl) valueEl.textContent = value[0];
      if (copyEl) copyEl.textContent = value[1];
    });

    const availabilityCard = document.getElementById("kpi-availability-value")?.closest(".kpi");
    if (availabilityCard?.querySelector("span")) availabilityCard.querySelector("span").textContent = "Live availability";
  };

  applyDestinationContext = function applyMultiRegionDestinationContext(options = {}) {
    if (!state.destination) return originalApplyDestinationContext(options);
    const region = resolveRegion(state.destination.lat, state.destination.lng);
    clearKildareCoverageOverlay();
    activateRegion(region, { notify: false });
    const result = originalApplyDestinationContext(options);
    updateRegionChrome(region);
    if (region === "kildare" && state.kildareNetworkStatus === "loading") {
      setMapStatus("Loading Kildare parking network", "Connecting County Council + OpenStreetMap inventory");
    }
    return result;
  };

  function nearestHub(item) {
    let winner = null;
    let best = Infinity;
    hubs.forEach(hub => {
      const distance = haversineKm(item.lat, item.lng, hub.lat, hub.lng);
      if (distance < best) {
        best = distance;
        winner = hub;
      }
    });
    return winner && best <= 15 ? winner.name : "Other Kildare";
  }

  function clusterCounts() {
    const counts = new Map(hubs.map(hub => [hub.name, 0]));
    counts.set("Other Kildare", 0);
    (state.regionInventories.kildare || []).forEach(item => {
      const hub = nearestHub(item);
      counts.set(hub, (counts.get(hub) || 0) + 1);
    });
    return counts;
  }

  function updateNetworkPanel() {
    const host = document.getElementById("view-network");
    if (!host) return;
    let panel = document.getElementById("kildare-network-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "kildare-network-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      const grid = host.querySelector(".network-grid");
      host.insertBefore(panel, grid || null);
    }

    const snapshot = state.regionSnapshots.kildare;
    const counts = clusterCounts();
    const total = snapshot?.summary?.locations ?? state.regionInventories.kildare?.length ?? 0;
    const accessible = snapshot?.summary?.accessible_locations ?? 0;
    const chips = hubs.map(hub => {
      const count = counts.get(hub.name) || 0;
      return `<button type="button" data-kildare-hub="${escapeHtml(hub.name)}" style="border:1px solid rgba(120,230,170,.18);background:#0b1712;color:#edf7f1;border-radius:999px;padding:7px 10px;font:600 11px 'DM Sans';">${escapeHtml(hub.name)} · ${count}</button>`;
    }).join("");

    panel.innerHTML = `
      <p class="eyebrow">Kildare county network</p>
      <h3 style="margin:5px 0 6px">${total || "Loading"} mapped parking locations across town clusters</h3>
      <p style="margin:0;color:#8fa39a;font-size:12px;line-height:1.5">Logical WHITEBLOCK inventory network — not a driving-route claim. ${accessible ? `${accessible} accessible locations are represented from Kildare County Council's official layer.` : "Official accessible-parking data is loading."}</p>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px">${chips}</div>`;

    panel.querySelectorAll("[data-kildare-hub]").forEach(button => {
      button.addEventListener("click", () => {
        const hub = hubs.find(item => item.name === button.dataset.kildareHub);
        if (!hub) return;
        const destination = {
          primary: hub.name,
          secondary: "County Kildare, Ireland",
          label: `${hub.name}, County Kildare, Ireland`,
          lat: hub.lat,
          lng: hub.lng,
          type: "town",
          source: "WHITEBLOCK network hub"
        };
        selectAddressSuggestion(destination, { runRanking: true });
        setView("find");
      });
    });
  }

  function clearKildareCoverageOverlay() {
    if (state.map && state.kildareCoverageLayer) {
      state.map.removeLayer(state.kildareCoverageLayer);
      state.kildareCoverageLayer = null;
    }
  }

  function renderKildareCoverageOverlay() {
    if (!state.map || typeof L === "undefined") return;
    clearKildareCoverageOverlay();
    state.kildareCoverageLayer = L.layerGroup().addTo(state.map);

    const bounds = [
      [WB_KILDARE_BOUNDS.south, WB_KILDARE_BOUNDS.west],
      [WB_KILDARE_BOUNDS.north, WB_KILDARE_BOUNDS.east]
    ];
    L.rectangle(bounds, {
      color: "#78E6AA",
      weight: 1.4,
      dashArray: "8 7",
      fillColor: "#78E6AA",
      fillOpacity: 0.035,
      interactive: true
    }).bindTooltip("Kildare network coverage envelope · published KCC geographic coverage", { sticky: true }).addTo(state.kildareCoverageLayer);

    const hubByName = new Map(hubs.map(hub => [hub.name, hub]));
    hubEdges.forEach(([from, to]) => {
      const a = hubByName.get(from);
      const b = hubByName.get(to);
      if (!a || !b) return;
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: "#78E6AA",
        weight: 1,
        opacity: 0.35,
        dashArray: "4 7",
        interactive: false
      }).addTo(state.kildareCoverageLayer);
    });

    const counts = clusterCounts();
    hubs.forEach(hub => {
      L.circleMarker([hub.lat, hub.lng], {
        radius: 5,
        color: "#C8F56B",
        weight: 1.5,
        fillColor: "#07110D",
        fillOpacity: 1
      }).bindTooltip(`${hub.name} · ${counts.get(hub.name) || 0} mapped assets`, { direction: "top" }).addTo(state.kildareCoverageLayer);
    });
  }

  function registerCoverageAndFallbacks() {
    if (!coverageAreas.some(area => area.name === "Kildare")) {
      coverageAreas.splice(1, 0, { name: "Kildare", lat: 53.20, lng: -6.78, status: "live", label: "County parking network connected" });
    }
    hubs.forEach(hub => {
      if (fallbackPlaces.some(place => place.primary === hub.name && String(place.secondary).includes("Kildare"))) return;
      fallbackPlaces.push({
        primary: hub.name,
        secondary: "County Kildare, Ireland",
        label: `${hub.name}, County Kildare, Ireland`,
        lat: hub.lat,
        lng: hub.lng,
        type: "town",
        source: "WHITEBLOCK Kildare fallback"
      });
    });
  }

  async function loadKildareSnapshot() {
    try {
      const response = await fetch(`${SNAPSHOT_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Kildare snapshot returned ${response.status}`);
      const snapshot = await response.json();
      if (!Array.isArray(snapshot.locations) || !snapshot.locations.length) throw new Error("Kildare snapshot contains no parking locations");

      state.regionSnapshots.kildare = snapshot;
      state.regionInventories.kildare = snapshot.locations
        .map(hydrateKildare)
        .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      state.kildareNetworkStatus = "ready";
      updateNetworkPanel();

      if (state.destination && resolveRegion(state.destination.lat, state.destination.lng) === "kildare") {
        activateRegion("kildare", { notify: true });
        originalApplyDestinationContext({ runRanking: true });
      }
    } catch (error) {
      console.error("WHITEBLOCK Kildare network unavailable", error);
      state.kildareNetworkStatus = "error";
      if (state.activeRegion === "kildare") {
        state.dataStatus = "error";
        renderParkingList();
        setMapStatus("Kildare network temporarily unavailable", "No demo parking values will be substituted");
      }
    }
  }

  document.addEventListener("whiteblock:data-ready", () => {
    const region = String(state.parkingSnapshot?.coverage?.region || "").toLowerCase();
    if (!region || region === "cork") captureCorkInventory();
  });

  document.getElementById("ireland-overview-button")?.addEventListener("click", () => {
    window.setTimeout(renderKildareCoverageOverlay, 90);
  });

  registerCoverageAndFallbacks();
  captureCorkInventory();
  updateNetworkPanel();
  void loadKildareSnapshot();
})();
