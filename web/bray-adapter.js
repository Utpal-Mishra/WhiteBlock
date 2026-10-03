// WHITEBLOCK Bray seafront regional adapter.
// Loads a curated evidence snapshot without treating imagery as live occupancy.
// Loaded after api-adapter.js so the PostGIS API keeps its Cork-only request gate.

(() => {
  if (typeof state === "undefined") return;

  const BRAY_CENTER = { lat: 53.2048, lng: -6.0996 };
  const BRAY_RADIUS_KM = 5;
  const BRAY_SNAPSHOT_URL = "./data/bray_parking_snapshot.json";
  const originalCoverageGate = isInCorkPilot;
  const originalSetKpiMode = setKpiMode;
  const originalApplyDestinationContext = applyDestinationContext;

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.regionStatus = state.regionStatus || {};
  state.regionStatus.bray = "loading";

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function priceNumber(raw) {
    if (!raw) return null;
    const match = String(raw).match(/€\s*([0-9]+(?:[.,][0-9]+)?)/i);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function isInBrayCoverage(lat, lng) {
    return haversineKm(lat, lng, BRAY_CENTER.lat, BRAY_CENTER.lng) <= BRAY_RADIUS_KM;
  }

  window.isInBrayCoverage = isInBrayCoverage;
  isInCorkPilot = function whiteblockRegionalCoverage(lat, lng) {
    return originalCoverageGate(lat, lng) || isInBrayCoverage(lat, lng);
  };

  function hydrate(record) {
    const confidenceScore = numeric(record && record.confidence && record.confidence.score);
    return {
      id: record.parking_id,
      name: record.name || record.parking_id,
      area: "Bray",
      region: "Bray",
      lat: numeric(record.latitude),
      lng: numeric(record.longitude),
      available: numeric(record.available_spaces),
      capacity: numeric(record.capacity),
      occupancyRatio: numeric(record.occupancy_ratio),
      confidence: Math.round((confidenceScore == null ? 0.7 : confidenceScore) * 100),
      confidenceBasis: (record.confidence && record.confidence.basis) || {},
      accessible: numeric(record.accessible_spaces) > 0 ? true : null,
      accessibleSpaces: numeric(record.accessible_spaces),
      ev: numeric(record.ev_spaces) > 0 ? true : null,
      evSpaces: numeric(record.ev_spaces),
      pricingRaw: record.pricing_raw || null,
      openingHoursRaw: record.opening_hours_raw || null,
      maxStayMinutes: numeric(record.maximum_stay_minutes),
      heightRestrictionRaw: record.height_restriction_raw || null,
      observedAt: null,
      retrievedAt: state.regionSnapshots.bray && state.regionSnapshots.bray.source ? state.regionSnapshots.bray.source.retrieved_at : null,
      truthState: record.truth_state || "observed",
      sourceKey: record.source_key || "bray_seafront_evidence",
      sourceNotes: record.source_notes || null,
      restrictionNotes: record.restriction_notes || null,
      distanceKm: null,
      walk: null,
      price: priceNumber(record.pricing_raw),
      accessType: record.access_type || "unknown",
      parkingType: record.parking_type || "unknown",
      lifecycleState: record.lifecycle_state || "active",
      imageryReview: record.imagery_review || null,
      evidenceCount: Array.isArray(record.evidence) ? record.evidence.length : 0,
      __brayRegion: true
    };
  }

  function mergeBrayIntoParkingData() {
    const bray = state.regionInventories.bray;
    if (!Array.isArray(bray) || !bray.length || !Array.isArray(parkingData)) return false;
    const withoutBray = parkingData.filter(item => !item.__brayRegion && !String(item.id || "").startsWith("WB-PARK-IE-WW-BRAY-"));
    parkingData = withoutBray.concat(bray.map(item => ({ ...item })));
    return true;
  }

  function rebuildMarkers() {
    if (!state.map || typeof L === "undefined") return;
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers.clear();
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
        ? Math.round(item.available) + " spaces reported free"
        : (item.capacity != null ? Math.round(item.capacity) + " spaces capacity · live availability unknown" : "live availability unknown");
      marker.bindTooltip(item.name + " · " + availability, { direction: "top", offset: [0, -22], className: "wb-tooltip" });
      marker.on("click", () => selectParking(item.id));
      state.markers.set(item.id, marker);
    });
  }

  function brayNearby() {
    if (!state.destination) return state.regionInventories.bray || [];
    return (state.regionInventories.bray || []).filter(item =>
      Number.isFinite(item.lat) && Number.isFinite(item.lng) &&
      haversineKm(state.destination.lat, state.destination.lng, item.lat, item.lng) <= 10
    );
  }

  setKpiMode = function regionalKpiMode(inCoverage) {
    if (!state.destination || !isInBrayCoverage(state.destination.lat, state.destination.lng)) {
      return originalSetKpiMode(inCoverage);
    }
    const rows = brayNearby();
    const confidences = rows.map(item => item.confidence).filter(Number.isFinite);
    const knownCapacity = rows.reduce((sum, item) => sum + (item.capacity || 0), 0);
    const values = {
      coverage: [String(rows.length), "evidence-backed parking assets within 10 km"],
      availability: ["—", "no live Bray occupancy feed connected yet"],
      confidence: [confidences.length ? Math.round(confidences.reduce((a,b) => a+b,0) / confidences.length) + "%" : "—", "rules + mapped evidence + imagery"],
      pressure: ["Unknown", knownCapacity ? "partial capacity only; live demand not observed" : "capacity verification still in progress"]
    };
    [["coverage", values.coverage], ["availability", values.availability], ["confidence", values.confidence], ["pressure", values.pressure]].forEach(entry => {
      const key = entry[0], value = entry[1];
      const valueEl = document.getElementById("kpi-" + key + "-value");
      const copyEl = document.getElementById("kpi-" + key + "-copy");
      if (valueEl) valueEl.textContent = value[0];
      if (copyEl) copyEl.textContent = value[1];
    });
  };

  applyDestinationContext = function regionalDestinationContext(options) {
    mergeBrayIntoParkingData();
    const result = originalApplyDestinationContext(options || {});
    if (state.destination && isInBrayCoverage(state.destination.lat, state.destination.lng)) {
      const mapTitle = document.getElementById("map-title");
      if (mapTitle) mapTitle.textContent = "Parking around your Bray destination";
      if (state.regionStatus.bray === "ready") {
        setMapStatus("Bray seafront parking intelligence", "Official rules + mapped parking evidence · live occupancy not connected");
      } else {
        setMapStatus("Bray seafront parking intelligence", "Loading Bray evidence layer");
      }
    }
    return result;
  };

  async function loadBray() {
    try {
      const response = await fetch(BRAY_SNAPSHOT_URL + "?v=" + Date.now(), { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Bray parking snapshot returned " + response.status);
      const snapshot = await response.json();
      if (!snapshot || !Array.isArray(snapshot.locations)) throw new Error("Invalid Bray parking snapshot");

      state.regionSnapshots.bray = snapshot;
      state.regionInventories.bray = snapshot.locations.map(hydrate).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      state.regionStatus.bray = "ready";

      mergeBrayIntoParkingData();
      rebuildMarkers();
      setKpiMode(isInCorkPilot(state.destination.lat, state.destination.lng));
      renderParkingList();

      if (state.destination && isInBrayCoverage(state.destination.lat, state.destination.lng)) {
        setMapStatus("Bray seafront parking intelligence", state.regionInventories.bray.length + " evidence-backed assets · live occupancy not connected");
      }

      document.dispatchEvent(new CustomEvent("whiteblock:region-inventory-ready", {
        detail: { region: "bray", locations: state.regionInventories.bray.length, candidates: Array.isArray(snapshot.candidates) ? snapshot.candidates.length : 0 }
      }));
    } catch (error) {
      console.error("WHITEBLOCK Bray evidence snapshot load failed", error);
      state.regionStatus.bray = "error";
    }
  }

  document.addEventListener("whiteblock:data-ready", event => {
    if (event && event.detail && event.detail.region === "bray") return;
    if (mergeBrayIntoParkingData()) {
      rebuildMarkers();
      if (state.destination && isInBrayCoverage(state.destination.lat, state.destination.lng)) {
        setKpiMode(true);
        renderParkingList();
      }
    }
  });

  loadBray();
})();
