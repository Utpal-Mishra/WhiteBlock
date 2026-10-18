// County Wicklow mapped parking overlay. Bray retains its independently curated
// seafront pilot; this snapshot excludes its 5 km coverage area to avoid double count.
// A mapped place does NOT imply live occupancy or verified public access.
(() => {
  if (typeof state === "undefined" || typeof haversineKm !== "function") return;
  const SNAPSHOT_URL = "./data/wicklow_parking_snapshot.json";
  const COUNTY_RELATION_ID = 282760;
  const ENVELOPE = { south: 52.68, north: 53.26, west: -6.86, east: -5.94 };
  const hubs = [
    ["Wicklow Town", 52.9808, -6.0446],
    ["Greystones", 53.1434, -6.0635],
    ["Arklow", 52.7932, -6.1412],
    ["Blessington", 53.1693, -6.5328],
    ["Baltinglass", 52.9405, -6.7068],
    ["Rathdrum", 52.9316, -6.2291],
    ["Glendalough / Laragh", 53.0102, -6.3288],
    ["Roundwood", 53.0646, -6.2258],
    ["Newtownmountkennedy", 53.0897, -6.1116],
    ["Enniskerry", 53.1920, -6.1692],
    ["Kilcoole", 53.1019, -6.0656],
    ["Aughrim", 52.8540, -6.3316],
    ["Avoca", 52.8521, -6.2160],
    ["Brittas Bay", 52.8725, -6.0813],
    ["Dunlavin", 53.0581, -6.7043],
    ["Carnew", 52.7077, -6.4941],
    ["Shillelagh", 52.7530, -6.5379],
    ["Tinahely", 52.7974, -6.4633],
    ["Ashford", 53.0120, -6.1113],
    ["Rathnew", 52.9906, -6.0858]
  ];
  const formerCoverageGate = isInCorkPilot;
  const formerApplyDestination = applyDestinationContext;
  const formerSetKpiMode = setKpiMode;

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.wicklowNetworkStatus = "loading";

  function numberOrNull(value) {
    return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
  }

  function destinationText() {
    const d = state.destination || {};
    return [d.primary, d.secondary, d.label].filter(Boolean).join(" ");
  }

  function insideWicklowEnvelope(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= ENVELOPE.south && lat <= ENVELOPE.north &&
      lng >= ENVELOPE.west && lng <= ENVELOPE.east;
  }

  function isInWicklowCoverage(lat, lng) {
    if (!insideWicklowEnvelope(lat, lng)) return false;
    // The existing Bray pilot is authoritative inside its own 5 km circle.
    if (window.isInBrayCoverage?.(lat, lng)) return false;
    const label = destinationText();
    const wicklowText = /\b(?:county|co\.?)\s*wicklow\b|\bwicklow\b/i.test(label);
    const differentCounty = /\b(?:county|co\.?)\s*(?:dublin|kildare|wexford|carlow)\b/i.test(label);
    if (differentCounty && !wicklowText) return false;
    if (wicklowText) return true;
    // Geocoder results occasionally omit the county. Town anchors are only
    // a browsing fallback, NOT an exact administrative boundary check.
    return hubs.some(([, hLat, hLng]) => haversineKm(lat, lng, hLat, hLng) <= 12);
  }

  window.isInWicklowCoverage = isInWicklowCoverage;
  isInCorkPilot = function isInConnectedWicklowRegion(lat, lng) {
    return formerCoverageGate(lat, lng) || isInWicklowCoverage(lat, lng);
  };

  function hydrate(record) {
    const capacity = numberOrNull(record.capacity);
    const rawPrice = record.pricing_raw || null;
    // We do not parse ambiguous OSM "fee=yes"/"fee=no" tags as a monetary price.
    const euros = rawPrice && String(rawPrice).match(/€\s*([0-9]+(?:[,.][0-9]+)?)/);
    return {
      id: record.parking_id,
      name: record.name || "Mapped parking",
      area: record.area || "County Wicklow",
      region: "Wicklow",
      lat: numberOrNull(record.latitude),
      lng: numberOrNull(record.longitude),
      geometry: record.geometry || null,
      geometryTruthState: record.geometry_truth_state || null,
      available: null,
      capacity,
      occupancyRatio: null,
      confidence: Math.round((numberOrNull(record.confidence?.score) ?? 0.65) * 100),
      confidenceBasis: record.confidence?.basis || {},
      accessible: (numberOrNull(record.accessible_spaces) || 0) > 0 ? true : null,
      ev: (numberOrNull(record.ev_spaces) || 0) > 0 ? true : null,
      pricingRaw: rawPrice,
      openingHoursRaw: record.opening_hours_raw || null,
      heightRestrictionRaw: record.height_restriction_raw || null,
      maxStayMinutes: numberOrNull(record.maximum_stay_minutes),
      observedAt: record.observed_at || null,
      retrievedAt: record.retrieved_at || null,
      truthState: record.truth_state || "observed",
      sourceKey: record.source_key || "openstreetmap_wicklow_parking",
      sourceUrl: record.source_url || null,
      networkRole: record.network_role || "parking_asset",
      parkingType: record.parking_type || "parking",
      accessType: record.access_type || "unknown",
      price: euros ? Number(euros[1].replace(",", ".")) : null,
      distanceKm: null,
      walk: null,
      reason: "Mapped County Wicklow parking. Access, fees and maximum stay depend on source evidence and current signage. Live free-space data is unavailable.",
      __wicklowRegion: true
    };
  }

  function rebuildMarkers() {
    if (!state.map || typeof L === "undefined" || !state.markers) return;
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers.clear();
    parkingData.forEach(item => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const marker = L.marker([item.lat, item.lng], {
        icon: L.divIcon({ className: "wb-marker-wrapper", html: markerHtml(item),
          iconSize: [34, 34], iconAnchor: [17, 30] })
      }).addTo(state.map);
      marker.bindTooltip(item.name + " · mapped parking · availability unknown", {
        direction: "top", offset: [0, -22], className: "wb-tooltip"
      });
      marker.on("click", () => selectParking(item.id));
      state.markers.set(item.id, marker);
    });
  }

  function useWicklowInventory() {
    state.activeRegion = "wicklow";
    const rows = state.regionInventories.wicklow || [];
    parkingData = rows.map(item => ({ ...item }));
    state.parkingSnapshot = state.regionSnapshots.wicklow || null;
    state.dataStatus = state.wicklowNetworkStatus === "ready" ? "ready" : "loading";
    state.selectedId = parkingData[0]?.id || null;
    rebuildMarkers();
  }

  setKpiMode = function countyWicklowKpis(inConnectedRegion) {
    if (state.activeRegion !== "wicklow" || !state.destination ||
        !isInWicklowCoverage(state.destination.lat, state.destination.lng)) {
      return formerSetKpiMode(inConnectedRegion);
    }
    const near = (state.regionInventories.wicklow || []).filter(
      p => haversineKm(state.destination.lat, state.destination.lng, p.lat, p.lng) <= 12
    );
    const confidences = near.map(p => p.confidence).filter(Number.isFinite);
    const knownCapacity = near.reduce((sum, p) => sum + (p.capacity || 0), 0);
    const values = {
      coverage: [String(near.length), "mapped Wicklow parking assets within 12 km"],
      availability: ["—", "no live occupancy source for Wicklow"],
      confidence: [confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) + "%" : "—",
        "source + recorded attribute completeness"],
      pressure: ["Unknown", knownCapacity ? knownCapacity + " recorded spaces nearby · occupancy unknown" :
        "capacity and demand not established"]
    };
    Object.entries(values).forEach(([key, [value, copy]]) => {
      const valueEl = document.getElementById("kpi-" + key + "-value");
      const copyEl = document.getElementById("kpi-" + key + "-copy");
      if (valueEl) valueEl.textContent = value;
      if (copyEl) copyEl.textContent = copy;
    });
  };

  applyDestinationContext = function countyWicklowDestination(options = {}) {
    const result = formerApplyDestination(options);
    const dest = state.destination;
    if (!dest || !isInWicklowCoverage(dest.lat, dest.lng)) return result;
    useWicklowInventory();
    setKpiMode(true);
    renderParkingList();
    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = "Parking around your County Wicklow destination";
    const eyebrow = document.querySelector(".topbar .eyebrow");
    if (eyebrow) eyebrow.textContent = "Ireland · County Wicklow mapped parking";
    if (typeof setMapStatus === "function") {
      setMapStatus(
        state.wicklowNetworkStatus === "ready" ? "County Wicklow parking network" : "Loading Wicklow parking evidence",
        state.wicklowNetworkStatus === "ready"
          ? "Exact county OSM inventory outside Bray pilot · not exhaustive · live occupancy unavailable"
          : "No unverified spaces or live availability will be invented"
      );
    }
    if (options.runRanking) {
      const heading = document.getElementById("view-title");
      if (heading) heading.textContent = "Best mapped parking for " + dest.primary + ".";
    }
    return result;
  };

  // Towns are search anchors, not invented parking assets.
  if (typeof fallbackPlaces !== "undefined") {
    hubs.forEach(([name, lat, lng]) => {
      if (fallbackPlaces.some(p => p.primary === name && String(p.secondary || "").includes("Wicklow"))) return;
      fallbackPlaces.push({ primary: name, secondary: "County Wicklow, Ireland",
        label: name + ", County Wicklow, Ireland", lat, lng,
        type: "town", source: "WHITEBLOCK Wicklow navigation anchor" });
    });
  }

  if (typeof coverageAreas !== "undefined" && !coverageAreas.some(a => a.name === "Wicklow")) {
    coverageAreas.push({ name: "Wicklow", lat: 52.98, lng: -6.30,
      status: "live", label: "Mapped parking inventory · not live occupancy" });
  }

  async function loadWicklowSnapshot() {
    try {
      const response = await fetch(SNAPSHOT_URL + "?v=" + Date.now(),
        { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw Error("Wicklow snapshot HTTP " + response.status);
      const snapshot = await response.json();
      if (!Array.isArray(snapshot.locations) || !snapshot.locations.length ||
          snapshot.coverage?.scope !== "county_mapped_inventory_excluding_bray_pilot" ||
          Number(snapshot.coverage?.osm_boundary_relation_id) !== COUNTY_RELATION_ID ||
          snapshot.coverage?.coverage_complete !== false ||
          snapshot.summary?.live_availability !== false) {
        throw Error("Wicklow snapshot provenance or non-live guarantee invalid");
      }
      state.regionSnapshots.wicklow = snapshot;
      state.regionInventories.wicklow = snapshot.locations.map(hydrate)
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      state.wicklowNetworkStatus = "ready";
      document.dispatchEvent(new CustomEvent("whiteblock:region-inventory-ready", {
        detail: { region: "wicklow", locations: state.regionInventories.wicklow.length,
          coverage: "mapped_partial", source: "openstreetmap" }
      }));
      if (state.destination && isInWicklowCoverage(state.destination.lat, state.destination.lng)) {
        applyDestinationContext({ runRanking: true });
      }
    } catch (error) {
      console.error("WHITEBLOCK Wicklow mapped inventory unavailable", error);
      state.wicklowNetworkStatus = "error";
      if (state.activeRegion === "wicklow" && typeof setMapStatus === "function") {
        setMapStatus("Wicklow inventory source unavailable",
          "This county has no usable snapshot in the current deployment; showing no fabricated inventory");
      }
    }
  }

  void loadWicklowSnapshot();
})();
