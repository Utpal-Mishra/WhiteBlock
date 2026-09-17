// WHITEBLOCK API-first adapter.
// If runtime-config.js provides apiBaseUrl, PostGIS API results replace the
// build-time Cork snapshot. If the API is absent or unavailable, the static
// evidence-backed snapshot remains the safe fallback.

(() => {
  const config = window.WHITEBLOCK_CONFIG || {};
  const apiBaseUrl = String(config.apiBaseUrl || "").trim().replace(/\/$/, "");
  const API_RADIUS_KM = 10;
  const API_LIMIT = 16;

  state.dataMode = apiBaseUrl ? "api-pending" : "snapshot";
  state.apiBaseUrl = apiBaseUrl || null;
  state.apiRequestController = null;
  state.apiRequestSequence = 0;
  state.snapshotFallbackData = null;
  state.snapshotFallbackMetadata = null;

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function hydrateSnapshotRuleFields() {
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

  function refreshSnapshotRules(event) {
    if (event?.detail?.mode === "api") return;
    if (hydrateSnapshotRuleFields()) window.WBSessionRules?.refresh?.();
  }

  document.addEventListener("whiteblock:data-ready", refreshSnapshotRules);
  refreshSnapshotRules();

  if (!apiBaseUrl) return;

  function priceNumber(raw) {
    if (!raw) return null;
    const match = String(raw).match(/€\s*([0-9]+(?:[.,][0-9]+)?)/i);
    if (!match) return null;
    return Number(match[1].replace(",", "."));
  }

  function normalizeApiRecord(record) {
    const confidenceScore = numeric(record?.confidence?.score);
    return {
      id: record.parking_id,
      name: record.name || record.parking_id,
      area: "Cork",
      lat: numeric(record.latitude),
      lng: numeric(record.longitude),
      available: numeric(record.available_spaces),
      capacity: numeric(record.capacity),
      occupancyRatio: numeric(record.occupancy_ratio),
      confidence: Math.round((confidenceScore ?? 0.7) * 100),
      confidenceBasis: record?.confidence?.basis || {},
      accessible: numeric(record.accessible_spaces) > 0 ? true : null,
      ev: numeric(record.ev_spaces) > 0 ? true : null,
      pricingRaw: record.pricing_raw || null,
      openingHoursRaw: record.opening_hours_raw || null,
      maxStayMinutes: numeric(record.maximum_stay_minutes),
      heightRestrictionRaw: record.height_restriction_raw || null,
      observedAt: record.observed_at || null,
      retrievedAt: record.retrieved_at || null,
      truthState: record.truth_state || "observed",
      sourceKey: record.source_key || "postgis",
      distanceKm: numeric(record.distance_m) != null ? numeric(record.distance_m) / 1000 : null,
      walk: null,
      price: priceNumber(record.pricing_raw),
      reason: "",
      accessType: record.access_type || "unknown",
      parkingType: record.parking_type || "unknown",
      evidenceCount: Number(record.evidence_count || 0)
    };
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
      const available = item.available != null ? `${Math.round(item.available)} spaces reported free` : "availability unknown";
      marker.bindTooltip(`${item.name} · ${available}`, {
        direction: "top",
        offset: [0, -22],
        className: "wb-tooltip"
      });
      marker.on("click", () => selectParking(item.id));
      state.markers.set(item.id, marker);
    });
  }

  function apiUrl(destination) {
    const params = new URLSearchParams({
      lat: String(destination.lat),
      lng: String(destination.lng),
      radius_km: String(API_RADIUS_KM),
      limit: String(API_LIMIT),
      include_restricted: "false"
    });
    return `${apiBaseUrl}/v1/parking/nearby?${params.toString()}`;
  }

  function captureSnapshotFallback() {
    if (!parkingData.length || state.dataMode === "api") return;
    state.snapshotFallbackData = parkingData.map(item => ({ ...item }));
    state.snapshotFallbackMetadata = state.parkingSnapshot
      ? JSON.parse(JSON.stringify(state.parkingSnapshot))
      : null;
  }

  function restoreSnapshotFallback(previousData, previousSnapshot) {
    const fallbackData = state.snapshotFallbackData?.length
      ? state.snapshotFallbackData.map(item => ({ ...item }))
      : previousData;
    const fallbackMetadata = state.snapshotFallbackMetadata || previousSnapshot;

    parkingData = fallbackData;
    state.parkingSnapshot = fallbackMetadata;
    state.dataMode = "snapshot-fallback";
    state.dataStatus = fallbackData.length ? "ready" : "error";
    hydrateSnapshotRuleFields();
    const ranked = currentData();
    state.selectedId = ranked[0]?.id || fallbackData[0]?.id || null;
    rebuildMarkers();
    setKpiMode(true);
    renderParkingList();

    if (fallbackData.length) {
      setMapStatus("Cork official snapshot", "API unavailable · using the latest evidence-backed Pages snapshot");
    } else {
      setMapStatus("Parking data unavailable", "API and snapshot are currently unavailable");
    }
  }

  async function loadApiParking(destination, { initial = false } = {}) {
    if (!destination || !isInCorkPilot(destination.lat, destination.lng)) return;

    const sequence = ++state.apiRequestSequence;
    if (state.apiRequestController) state.apiRequestController.abort();
    state.apiRequestController = new AbortController();

    const previousData = parkingData;
    const previousSnapshot = state.parkingSnapshot;
    if (!initial) {
      state.dataStatus = "loading";
      setKpiMode(true);
      renderParkingList();
    }

    try {
      const response = await fetch(apiUrl(destination), {
        signal: state.apiRequestController.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`WHITEBLOCK API returned ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.locations)) throw new Error("Invalid WHITEBLOCK API response");
      if (sequence !== state.apiRequestSequence) return;

      parkingData = payload.locations
        .map(normalizeApiRecord)
        .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));

      state.dataMode = "api";
      state.dataStatus = "ready";
      state.parkingSnapshot = {
        generated_at: payload.generated_at,
        source: {
          key: "whiteblock_postgis_api",
          retrieved_at: payload.generated_at,
          status: "ok"
        },
        coverage: {
          country: "IE",
          region: "Cork",
          mode: "postgis_api"
        },
        summary: { locations: parkingData.length }
      };

      const ranked = currentData();
      state.selectedId = ranked[0]?.id || parkingData[0]?.id || null;
      rebuildMarkers();
      setKpiMode(true);
      renderParkingList();

      const mapStatus = parkingData.length
        ? `${parkingData.length} PostGIS assets within ${payload.radius_km ?? API_RADIUS_KM} km`
        : `No verified PostGIS assets within ${payload.radius_km ?? API_RADIUS_KM} km`;
      setMapStatus("WHITEBLOCK spatial API", mapStatus);
      document.dispatchEvent(new CustomEvent("whiteblock:data-ready", {
        detail: { locations: parkingData.length, mode: "api" }
      }));
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn("WHITEBLOCK API unavailable; retaining snapshot fallback", error);
      if (sequence !== state.apiRequestSequence) return;
      restoreSnapshotFallback(previousData, previousSnapshot);
    }
  }

  const baseApplyDestinationContext = applyDestinationContext;
  applyDestinationContext = function applyDestinationContextApi(options = {}) {
    baseApplyDestinationContext(options);
    if (state.destination && isInCorkPilot(state.destination.lat, state.destination.lng)) {
      window.setTimeout(() => loadApiParking(state.destination), 20);
    }
  };

  let initialRequested = false;
  function requestInitialApiLoad() {
    if (initialRequested || !state.destination) return;
    initialRequested = true;
    captureSnapshotFallback();
    loadApiParking(state.destination, { initial: true });
  }

  document.addEventListener("whiteblock:data-ready", event => {
    if (event.detail?.mode === "api") return;
    captureSnapshotFallback();
    requestInitialApiLoad();
  }, { once: true });

  // If the snapshot cannot be loaded, the API should still get a chance to serve data.
  window.setTimeout(requestInitialApiLoad, 1200);
})();
