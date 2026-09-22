// WHITEBLOCK County Dublin network adapter.
// Loads the exact-boundary County Dublin snapshot and connects Dublin destinations
// to evidence-backed mapped parking without inventing live availability.

(() => {
  if (typeof state === "undefined" || typeof haversineKm !== "function") return;

  const SNAPSHOT_URL = "./data/dublin_parking_snapshot.json";
  const WB_DUBLIN_TRADITIONAL_RELATION_ID = 282800;
  const EXPECTED_RELATIONS = {
    "Dublin City": 1109531,
    "Fingal": 1114164,
    "Dún Laoghaire–Rathdown": 1115720,
    "South Dublin": 1117469
  };

  // This envelope is only a conservative destination-recognition fallback. The
  // parking inventory itself is created from exact LA relations, never this box.
  const DUBLIN_SEARCH_ENVELOPE = { south: 53.16, west: -6.58, north: 53.68, east: -5.98 };

  const hubs = [
    { name: "Dublin City Centre", lat: 53.3498, lng: -6.2603, type: "city" },
    { name: "Swords", lat: 53.4597, lng: -6.2181, type: "town" },
    { name: "Balbriggan", lat: 53.6082, lng: -6.1826, type: "town" },
    { name: "Skerries", lat: 53.5827, lng: -6.1080, type: "town" },
    { name: "Rush", lat: 53.5226, lng: -6.0982, type: "town" },
    { name: "Lusk", lat: 53.5271, lng: -6.1677, type: "village" },
    { name: "Malahide", lat: 53.4509, lng: -6.1540, type: "town" },
    { name: "Howth", lat: 53.3880, lng: -6.0659, type: "village" },
    { name: "Blanchardstown", lat: 53.3886, lng: -6.3754, type: "suburb" },
    { name: "Castleknock", lat: 53.3748, lng: -6.3634, type: "suburb" },
    { name: "Lucan", lat: 53.3577, lng: -6.4486, type: "town" },
    { name: "Tallaght", lat: 53.2878, lng: -6.3411, type: "town" },
    { name: "Clondalkin", lat: 53.3208, lng: -6.3947, type: "town" },
    { name: "Rathfarnham", lat: 53.3008, lng: -6.2858, type: "suburb" },
    { name: "Templeogue", lat: 53.2988, lng: -6.3087, type: "suburb" },
    { name: "Rathcoole", lat: 53.2820, lng: -6.4720, type: "village" },
    { name: "Saggart", lat: 53.2808, lng: -6.4448, type: "village" },
    { name: "Dún Laoghaire", lat: 53.2944, lng: -6.1339, type: "town" },
    { name: "Blackrock", lat: 53.3017, lng: -6.1778, type: "suburb" },
    { name: "Stillorgan", lat: 53.2888, lng: -6.1987, type: "suburb" },
    { name: "Dundrum", lat: 53.2903, lng: -6.2422, type: "suburb" },
    { name: "Sandyford", lat: 53.2760, lng: -6.2250, type: "suburb" },
    { name: "Dalkey", lat: 53.2784, lng: -6.1000, type: "town" },
    { name: "Killiney", lat: 53.2561, lng: -6.1135, type: "suburb" },
    { name: "Shankill", lat: 53.2364, lng: -6.1177, type: "village" },
    { name: "Stepaside", lat: 53.2534, lng: -6.2136, type: "village" },
    { name: "Finglas", lat: 53.3892, lng: -6.2960, type: "suburb" },
    { name: "Ballymun", lat: 53.3970, lng: -6.2640, type: "suburb" },
    { name: "Drumcondra", lat: 53.3700, lng: -6.2545, type: "suburb" },
    { name: "Clontarf", lat: 53.3608, lng: -6.1826, type: "suburb" },
    { name: "Raheny", lat: 53.3807, lng: -6.1758, type: "suburb" },
    { name: "Rathmines", lat: 53.3224, lng: -6.2655, type: "suburb" },
    { name: "Ranelagh", lat: 53.3253, lng: -6.2564, type: "suburb" },
    { name: "Ballsbridge", lat: 53.3297, lng: -6.2314, type: "suburb" }
  ];

  const dublinTextPattern = /\bdublin\b|fingal|d[uú]n\s+laoghaire|rathdown|south\s+dublin/i;
  const otherCountyPattern = /county\s+(meath|kildare|wicklow)|\b(meath|kildare|wicklow)\b/i;

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.dublinNetworkStatus = "loading";
  state.dublinCoverageLayer = null;

  const previousCoverageGate = isInCorkPilot;
  const previousApplyDestinationContext = applyDestinationContext;

  function destinationText() {
    const d = state.destination || {};
    return [d.primary, d.secondary, d.label].filter(Boolean).join(" ");
  }

  function insideEnvelope(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= DUBLIN_SEARCH_ENVELOPE.south && lat <= DUBLIN_SEARCH_ENVELOPE.north
      && lng >= DUBLIN_SEARCH_ENVELOPE.west && lng <= DUBLIN_SEARCH_ENVELOPE.east;
  }

  function nearestHubDistance(lat, lng) {
    return hubs.reduce((best, hub) => Math.min(best, haversineKm(lat, lng, hub.lat, hub.lng)), Infinity);
  }

  function isDublinCoverage(lat, lng) {
    if (!insideEnvelope(lat, lng)) return false;
    const text = destinationText();
    if (otherCountyPattern.test(text) && !dublinTextPattern.test(text)) return false;
    if (dublinTextPattern.test(text)) return true;
    return nearestHubDistance(lat, lng) <= 12;
  }

  function isDublinOnly(lat, lng) {
    return !previousCoverageGate(lat, lng) && isDublinCoverage(lat, lng);
  }

  // Preserve the historical identifier used throughout the UI as the connected-
  // coverage gate while adding County Dublin to Cork/Kildare coverage.
  isInCorkPilot = function isInConnectedRegionWithDublin(lat, lng) {
    return previousCoverageGate(lat, lng) || isDublinCoverage(lat, lng);
  };

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function priceNumber(raw) {
    if (!raw) return null;
    const match = String(raw).match(/€\s*([0-9]+(?:[.,][0-9]+)?)/i);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function hydrateDublin(record) {
    return {
      id: record.parking_id,
      name: record.name || record.parking_id,
      area: record.settlement || record.area || record.local_authority || "County Dublin",
      settlement: record.settlement || null,
      settlementType: record.settlement_type || null,
      settlementAssignmentMethod: record.settlement_assignment_method || null,
      localAuthority: record.local_authority || null,
      lat: numeric(record.latitude),
      lng: numeric(record.longitude),
      geometry: record.geometry || null,
      geometryTruthState: record.geometry_truth_state || null,
      available: null,
      capacity: numeric(record.capacity),
      occupancyRatio: null,
      confidence: Math.round(Number(record?.confidence?.score ?? 0.7) * 100),
      confidenceBasis: record?.confidence?.basis || {},
      accessible: Number(record.accessible_spaces || 0) > 0 ? true : null,
      ev: Number(record.ev_spaces || 0) > 0 ? true : null,
      pricingRaw: record.pricing_raw || null,
      openingHoursRaw: record.opening_hours_raw || null,
      maxStayMinutes: numeric(record.maximum_stay_minutes),
      heightRestrictionRaw: record.height_restriction_raw || null,
      observedAt: record.observed_at || null,
      retrievedAt: record.retrieved_at || null,
      truthState: record.truth_state || "observed",
      sourceKey: record.source_key || "dublin_network",
      sourceUrl: record.source_url || null,
      networkRole: record.network_role || "parking_asset",
      parkingType: record.parking_type || "parking",
      accessType: record.access_type || "unknown",
      distanceKm: null,
      walk: null,
      price: priceNumber(record.pricing_raw),
      reason: record.access_type && record.access_type !== "unknown"
        ? `Mapped County Dublin parking · access ${record.access_type} · live occupancy not connected.`
        : "Mapped County Dublin parking · access conditions not fully published · live occupancy not connected."
    };
  }

  function clearMarkers() {
    if (!state.map) return;
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers.clear();
  }

  function rebuildMarkers() {
    if (!state.map || typeof L === "undefined") return;
    clearMarkers();
    parkingData.forEach(item => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const icon = L.divIcon({
        className: "wb-marker-wrapper",
        html: markerHtml(item),
        iconSize: [34, 34],
        iconAnchor: [17, 30]
      });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(state.map);
      marker.bindTooltip(`${item.name} · county inventory · live availability not connected`, {
        direction: "top", offset: [0, -22], className: "wb-tooltip"
      });
      marker.on("click", () => selectParking(item.id));
      state.markers.set(item.id, marker);
    });
  }

  function updateDistances() {
    if (!state.destination) return;
    parkingData.forEach(item => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      item.distanceKm = haversineKm(state.destination.lat, state.destination.lng, item.lat, item.lng);
      // Walking time is an explicit approximation until a pedestrian-routing
      // service is connected; distance itself remains great-circle geometry.
      item.walk = Math.max(1, Math.round(item.distanceKm * 12));
    });
  }

  function renderDublinKpis() {
    const nearby = parkingData.filter(item => Number.isFinite(item.distanceKm) && item.distanceKm <= 10);
    const confidences = nearby.map(item => item.confidence).filter(Number.isFinite);
    const knownCapacity = nearby.reduce((sum, item) => sum + (item.capacity || 0), 0);
    const values = {
      coverage: [String(nearby.length), "mapped Dublin parking assets within 10 km"],
      availability: ["—", "live occupancy is not inferred for county inventory"],
      confidence: [confidences.length ? `${Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)}%` : "—", "source + freshness + completeness"],
      pressure: ["Network", knownCapacity ? `${knownCapacity.toLocaleString("en-IE")} known spaces in nearby published capacity` : "capacity is shown only where published"]
    };
    Object.entries(values).forEach(([key, value]) => {
      const valueEl = document.getElementById(`kpi-${key}-value`);
      const copyEl = document.getElementById(`kpi-${key}-copy`);
      if (valueEl) valueEl.textContent = value[0];
      if (copyEl) copyEl.textContent = value[1];
    });
    const availabilityCard = document.getElementById("kpi-availability-value")?.closest(".kpi");
    if (availabilityCard?.querySelector("span")) availabilityCard.querySelector("span").textContent = "Live availability";
  }

  function updateChrome() {
    const eyebrow = document.querySelector(".topbar .eyebrow");
    if (eyebrow) eyebrow.textContent = "Ireland · County Dublin parking network";
    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = "Parking around your Dublin destination";
    setMapStatus(
      "County Dublin parking network",
      "Dublin City + Fingal + Dún Laoghaire–Rathdown + South Dublin · mapped inventory · live occupancy not inferred"
    );
  }

  function activateDublin({ notify = true, runRanking = false } = {}) {
    state.activeRegion = "dublin";
    const inventory = state.regionInventories.dublin || [];
    parkingData = inventory.map(item => ({ ...item }));
    state.parkingSnapshot = state.regionSnapshots.dublin || null;
    state.dataStatus = state.dublinNetworkStatus === "ready" ? "ready" : "loading";
    updateDistances();
    const ranked = currentData();
    state.selectedId = ranked[0]?.id || parkingData[0]?.id || null;
    rebuildMarkers();
    renderDublinKpis();
    renderParkingList();
    updateChrome();

    if (state.map && state.destination) {
      state.map.flyTo([state.destination.lat, state.destination.lng], 14, { duration: 0.6 });
      addOrMoveDestinationMarker(state.destination);
    }
    if (runRanking) {
      const title = document.getElementById("view-title");
      if (title) title.textContent = `Best mapped parking for ${state.destination?.primary || "your Dublin destination"}.`;
    }
    if (notify) {
      document.dispatchEvent(new CustomEvent("whiteblock:data-ready", {
        detail: { region: "dublin", source: "dublin-network" }
      }));
    }
  }

  applyDestinationContext = function applyDestinationContextWithDublin(options = {}) {
    if (!state.destination || !isDublinOnly(state.destination.lat, state.destination.lng)) {
      return previousApplyDestinationContext(options);
    }

    // Let the pre-existing regional chain update the destination marker and its
    // own state first; it resolves Dublin as unsupported. Replace that result with
    // the exact Dublin inventory immediately afterwards.
    previousApplyDestinationContext({ ...options, runRanking: false });
    activateDublin({ notify: false, runRanking: Boolean(options.runRanking) });
    return undefined;
  };

  function networkPanel() {
    const host = document.getElementById("view-network");
    if (!host) return;
    let panel = document.getElementById("dublin-network-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-network-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      const grid = host.querySelector(".network-grid");
      host.insertBefore(panel, grid || null);
    }
    const snapshot = state.regionSnapshots.dublin;
    const summary = snapshot?.summary || {};
    const counts = summary.locations_by_local_authority || {};
    const chips = Object.entries(counts).map(([authority, count]) =>
      `<span style="border:1px solid rgba(120,230,170,.18);background:#0b1712;color:#edf7f1;border-radius:999px;padding:7px 10px;font:600 11px 'DM Sans';">${escapeHtml(authority)} · ${Number(count).toLocaleString("en-IE")}</span>`
    ).join("");
    panel.innerHTML = `
      <p class="eyebrow">County Dublin network</p>
      <h3 style="margin:5px 0 6px">${summary.locations ?? "Loading"} mapped parking assets across four Dublin local authorities</h3>
      <p style="margin:0;color:#8fa39a;font-size:12px;line-height:1.5">Boundary provenance: traditional County Dublin relation ${WB_DUBLIN_TRADITIONAL_RELATION_ID}; inventory is traversed through four exact current local-authority relations. This is complete boundary traversal, not a claim that every real-world parking space is mapped.</p>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px">${chips || "Loading authority counts…"}</div>`;
  }

  function registerCoverageAndFallbacks() {
    const existing = coverageAreas.find(area => area.name === "Dublin");
    if (existing) {
      existing.status = "live";
      existing.label = "County-wide mapped parking network";
    } else {
      coverageAreas.splice(1, 0, { name: "Dublin", lat: 53.3498, lng: -6.2603, status: "live", label: "County-wide mapped parking network" });
    }

    hubs.forEach(hub => {
      if (fallbackPlaces.some(place => place.primary === hub.name && /dublin/i.test(place.secondary || ""))) return;
      fallbackPlaces.push({
        primary: hub.name,
        secondary: "County Dublin, Ireland",
        label: `${hub.name}, County Dublin, Ireland`,
        lat: hub.lat,
        lng: hub.lng,
        type: hub.type,
        source: "WHITEBLOCK County Dublin fallback"
      });
    });
  }

  function clearCoverageOverlay() {
    if (state.map && state.dublinCoverageLayer) {
      state.map.removeLayer(state.dublinCoverageLayer);
      state.dublinCoverageLayer = null;
    }
  }

  function renderCoverageOverlay() {
    if (!state.map || typeof L === "undefined") return;
    clearCoverageOverlay();
    state.dublinCoverageLayer = L.layerGroup().addTo(state.map);
    hubs.forEach(hub => {
      L.circleMarker([hub.lat, hub.lng], {
        radius: 4.5,
        color: "#78E6AA",
        weight: 1.2,
        fillColor: "#07110D",
        fillOpacity: 1
      }).bindTooltip(`${hub.name} · Dublin coverage anchor`, { direction: "top" }).addTo(state.dublinCoverageLayer);
    });
  }

  function validateSnapshot(snapshot) {
    if (!Array.isArray(snapshot?.locations) || !snapshot.locations.length) throw new Error("Dublin snapshot contains no parking locations");
    if (snapshot?.coverage?.scope !== "county_wide_network") throw new Error("Dublin snapshot is not county-wide");
    if (snapshot?.coverage?.coverage_claim !== "complete_boundary_traversal_not_complete_real_world_inventory") throw new Error("Dublin completeness disclaimer missing");
    if (Number(snapshot?.coverage?.osm_traditional_county_relation_id) !== WB_DUBLIN_TRADITIONAL_RELATION_ID) throw new Error("Dublin boundary provenance mismatch");
    const actual = snapshot?.coverage?.local_authority_relation_ids || {};
    for (const [name, relation] of Object.entries(EXPECTED_RELATIONS)) {
      if (Number(actual[name]) !== relation) throw new Error(`Dublin local-authority relation mismatch for ${name}`);
      if (!(Number(snapshot?.summary?.locations_by_local_authority?.[name]) > 0)) throw new Error(`Dublin inventory missing ${name}`);
    }
    if (!(Number(snapshot?.summary?.mapped_polygon_locations) > 0)) throw new Error("Dublin snapshot contains no mapped parking polygons");
  }

  async function loadDublinSnapshot() {
    try {
      const response = await fetch(`${SNAPSHOT_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Dublin snapshot returned ${response.status}`);
      const snapshot = await response.json();
      validateSnapshot(snapshot);
      state.regionSnapshots.dublin = snapshot;
      state.regionInventories.dublin = snapshot.locations
        .map(hydrateDublin)
        .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      state.dublinNetworkStatus = "ready";
      networkPanel();

      if (state.destination && isDublinOnly(state.destination.lat, state.destination.lng)) {
        activateDublin({ notify: true, runRanking: true });
      } else {
        document.dispatchEvent(new CustomEvent("whiteblock:region-inventory-ready", {
          detail: { region: "dublin", locations: state.regionInventories.dublin.length }
        }));
      }
    } catch (error) {
      console.error("WHITEBLOCK County Dublin network unavailable", error);
      state.dublinNetworkStatus = "error";
      if (state.activeRegion === "dublin") {
        parkingData = [];
        state.dataStatus = "error";
        renderParkingList();
        setMapStatus("County Dublin network temporarily unavailable", "No demo parking values will be substituted");
      }
    }
  }

  document.getElementById("ireland-overview-button")?.addEventListener("click", () => {
    window.setTimeout(renderCoverageOverlay, 110);
  });

  registerCoverageAndFallbacks();
  networkPanel();
  void loadDublinSnapshot();
})();
