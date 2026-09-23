// WHITEBLOCK destination-first parking focus.
// When a user searches a connected destination, show the mapped parking supply
// around that destination immediately. Availability remains unknown unless a
// source explicitly publishes it. Customer-only venue parking is only surfaced
// as a normal destination option when it is associated with the selected venue.

(() => {
  if (typeof state === "undefined" || typeof haversineKm !== "function") return;

  const KILDARE_VILLAGE_DESTINATION = {
    primary: "Kildare Village",
    secondary: "Kildare, County Kildare, Ireland",
    label: "Kildare Village, Kildare, County Kildare, Ireland",
    lat: 53.15364,
    lng: -6.91816,
    type: "shopping",
    source: "WHITEBLOCK curated destination anchor"
  };

  const RADIUS_STEPS_KM = [1.0, 2.0, 3.5, 5.0, 8.0, 12.0];
  const MIN_LOCAL_RESULTS = 3;
  const MAX_FOCUSED_RESULTS = 30;
  const MAX_BOUNDS_POINTS = 14;

  state.destinationParkingFocusIds = state.destinationParkingFocusIds || new Set();
  state.destinationParkingDistances = state.destinationParkingDistances || new Map();
  state.destinationParkingFocusLayer = state.destinationParkingFocusLayer || null;
  state.destinationParkingFocusRadiusKm = null;

  function normalized(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function registerCuratedDestinations() {
    if (typeof fallbackPlaces === "undefined" || !Array.isArray(fallbackPlaces)) return;
    const exists = fallbackPlaces.some(place =>
      normalized(place.primary) === normalized(KILDARE_VILLAGE_DESTINATION.primary)
      && haversineKm(Number(place.lat), Number(place.lng), KILDARE_VILLAGE_DESTINATION.lat, KILDARE_VILLAGE_DESTINATION.lng) < 0.25
    );
    if (!exists) fallbackPlaces.push({ ...KILDARE_VILLAGE_DESTINATION });
  }

  function prioritiseCuratedSuggestions() {
    if (typeof fetchAddressSuggestions !== "function" || fetchAddressSuggestions.__wbDestinationFocusWrapped) return;
    const baseFetchAddressSuggestions = fetchAddressSuggestions;
    const wrapped = async function whiteblockDestinationSuggestions(query) {
      const items = await baseFetchAddressSuggestions(query);
      if (typeof fallbackPlaces === "undefined" || !Array.isArray(fallbackPlaces)) return items;

      const q = normalized(query);
      if (!q) return items;
      const exact = fallbackPlaces.filter(place => normalized(place.primary) === q || normalized(place.label) === q);
      if (!exact.length) return items;

      const output = [];
      const seen = new Set();
      [...exact, ...items].forEach(item => {
        const key = `${normalized(item.label)}|${Number(item.lat).toFixed(5)}|${Number(item.lng).toFixed(5)}`;
        if (seen.has(key)) return;
        seen.add(key);
        output.push(item);
      });
      return output.slice(0, 8);
    };
    wrapped.__wbDestinationFocusWrapped = true;
    fetchAddressSuggestions = wrapped;
  }

  function activeInventory() {
    const region = String(state.activeRegion || "").toLowerCase();
    const inventory = state.regionInventories?.[region];
    if (Array.isArray(inventory) && inventory.length) return inventory;
    return Array.isArray(parkingData) ? parkingData : [];
  }

  function sessionRule(item) {
    if (window.WBSessionRules && typeof window.WBSessionRules.evaluate === "function") {
      return window.WBSessionRules.evaluate(item);
    }
    const access = String(item.accessType || item.access_type || "unknown").toLowerCase();
    return {
      eligible: !["private", "permit", "restricted", "no"].includes(access),
      fitLabel: "Session rules not fully evaluated",
      reason: "Session rules not fully evaluated"
    };
  }

  function customerAccessMatchesDestination(item) {
    const access = String(item.accessType || item.access_type || "unknown").toLowerCase();
    if (!["customer", "customers", "destination"].includes(access)) return true;

    const associations = Array.isArray(item.venueAssociations) ? item.venueAssociations : [];
    const strongCustomerAssociations = associations.filter(association =>
      association?.suggestionState === "conditional_customer_parking"
      && association?.associationState === "name_or_operator_match"
    );

    // Legacy/source-backed customer parking that has not yet passed through the
    // venue knowledge layer keeps its existing conditional behaviour. Venue-
    // linked customer parking, however, is only promoted when the selected
    // destination is that venue.
    if (!strongCustomerAssociations.length) return true;

    const destinationVenueId = state.destination?.venueKnowledgeId || state.activeVenueKnowledge?.venue_id || null;
    if (!destinationVenueId) return false;
    return strongCustomerAssociations.some(association => association.venueId === destinationVenueId);
  }

  function mappedParkingRows() {
    if (!state.destination) return { rows: [], radiusKm: null };
    const rows = activeInventory()
      .filter(item => item?.id && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
      .filter(item => {
        const truth = String(item.truthState || item.truth_state || "observed").toLowerCase();
        const role = String(item.networkRole || item.network_role || "parking_asset").toLowerCase();
        return !["candidate", "inferred"].includes(truth) && !role.includes("candidate");
      })
      .map(item => ({ item, rule: sessionRule(item) }))
      .filter(({ item, rule }) => rule.eligible && customerAccessMatchesDestination(item))
      .map(({ item, rule }) => ({
        item: { ...item, sessionRule: rule },
        distanceKm: haversineKm(
          Number(state.destination.lat),
          Number(state.destination.lng),
          Number(item.lat),
          Number(item.lng)
        )
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (!rows.length) return { rows: [], radiusKm: null };

    let radiusKm = RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1];
    for (const radius of RADIUS_STEPS_KM) {
      if (rows.filter(row => row.distanceKm <= radius).length >= MIN_LOCAL_RESULTS) {
        radiusKm = radius;
        break;
      }
    }

    let selected = rows.filter(row => row.distanceKm <= radiusKm);
    if (!selected.length) selected = rows.slice(0, MIN_LOCAL_RESULTS);
    return { rows: selected.slice(0, MAX_FOCUSED_RESULTS), radiusKm };
  }

  function removeFocusLayer() {
    if (!state.map || !state.destinationParkingFocusLayer) return;
    try {
      if (state.map.hasLayer(state.destinationParkingFocusLayer)) state.map.removeLayer(state.destinationParkingFocusLayer);
    } catch (_) {}
    state.destinationParkingFocusLayer = null;
  }

  function accessCopy(item) {
    const access = String(item.accessType || item.access_type || "unknown").toLowerCase();
    if (["customer", "customers", "destination"].includes(access)) return "Customer parking";
    if (["public", "yes", "permissive"].includes(access)) return "Public parking";
    if (access === "permit") return "Permit parking";
    if (["private", "restricted", "no"].includes(access)) return "Restricted parking";
    return "Access not yet verified";
  }

  function availabilityCopy(item) {
    if (item.available != null) return `${Math.round(Number(item.available))} spaces reported free`;
    if (item.capacity != null) return `${Math.round(Number(item.capacity))} spaces capacity · live availability not reported`;
    return "Live availability not reported";
  }

  function sessionCopy(item) {
    const rule = item.sessionRule || sessionRule(item);
    return rule?.fitLabel || "Session rules not fully published";
  }

  function renderFocusedParking(rows) {
    if (!state.map || typeof L === "undefined") return;
    removeFocusLayer();
    if (!rows.length) return;

    const layer = L.layerGroup().addTo(state.map);
    rows.forEach(({ item, distanceKm }) => {
      const marker = L.circleMarker([Number(item.lat), Number(item.lng)], {
        radius: 7,
        color: "#C8F56B",
        weight: 2,
        fillColor: "#0B1712",
        fillOpacity: 0.95,
        opacity: 1
      }).addTo(layer);
      marker.bindTooltip(
        `<strong>${escapeHtml(item.name || "Parking")}</strong><br>${escapeHtml(accessCopy(item))} · ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} from destination<br>${escapeHtml(sessionCopy(item))}<br>${escapeHtml(availabilityCopy(item))}`,
        { direction: "top", offset: [0, -8], className: "wb-tooltip" }
      );
      marker.on("click", () => {
        if (Array.isArray(parkingData) && parkingData.some(row => row.id === item.id) && typeof selectParking === "function") {
          selectParking(item.id);
        } else {
          state.map.flyTo([Number(item.lat), Number(item.lng)], 17, { duration: 0.55 });
          marker.openTooltip();
        }
      });
    });
    state.destinationParkingFocusLayer = layer;
  }

  function ensureInventoryLayerVisible() {
    if (!state.map || !state.inventoryMarkerLayer) return;
    state.inventoryMarkersEnabled = true;
    try {
      if (!state.map.hasLayer(state.inventoryMarkerLayer)) state.inventoryMarkerLayer.addTo(state.map);
    } catch (_) {}
  }

  function fitDestinationAndParking(rows) {
    if (!state.map || !state.destination || typeof L === "undefined") return;
    const points = [[Number(state.destination.lat), Number(state.destination.lng)]];
    rows.slice(0, MAX_BOUNDS_POINTS).forEach(({ item }) => {
      points.push([Number(item.lat), Number(item.lng)]);
    });

    if (points.length === 1) {
      state.map.flyTo(points[0], 15, { duration: 0.6 });
      return;
    }
    const bounds = L.latLngBounds(points);
    state.map.fitBounds(bounds, { padding: [52, 52], maxZoom: 16, animate: true, duration: 0.65 });
  }

  function updateFocusedResultScope(rows) {
    state.destinationParkingFocusIds = new Set(rows.map(row => row.item.id));
    state.destinationParkingDistances = new Map(rows.map(row => [row.item.id, row.distanceKm]));

    if (rows.length && !state.destinationParkingFocusIds.has(state.selectedId)) {
      state.selectedId = rows[0].item.id;
    }
    if (typeof renderParkingList === "function") renderParkingList();
  }

  function updateMapMessage(rows, radiusKm) {
    const place = state.destination?.primary || state.destination?.label || "destination";
    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = `Parking around ${place}`;

    if (!rows.length) {
      if (typeof setMapStatus === "function") {
        setMapStatus(
          `No session-suitable mapped parking in the current ${RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1]} km research window`,
          "Mapped or venue parking may still exist, but WHITEBLOCK will not promote a candidate that fails known stay/access rules or lacks the required customer-destination association."
        );
      }
      return;
    }

    const liveCount = rows.filter(({ item }) => item.available != null).length;
    const radiusLabel = radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm.toFixed(radiusKm % 1 ? 1 : 0)} km`;
    if (typeof setMapStatus === "function") {
      setMapStatus(
        `${rows.length} session-suitable mapped parking location${rows.length === 1 ? "" : "s"} near ${place}`,
        liveCount
          ? `${liveCount} currently include reported availability; remaining locations stay availability-unknown. Search window: ${radiusLabel}.`
          : `Known access/stay rules are applied before display; live space availability is not inferred. Search window: ${radiusLabel}.`
      );
    }
  }

  function focusDestinationParking() {
    if (!state.destination || !state.map) return;
    const { rows, radiusKm } = mappedParkingRows();
    state.destinationParkingFocusRadiusKm = radiusKm;
    updateFocusedResultScope(rows);
    ensureInventoryLayerVisible();
    renderFocusedParking(rows);
    fitDestinationAndParking(rows);
    updateMapMessage(rows, radiusKm);

    document.dispatchEvent(new CustomEvent("whiteblock:destination-parking-focus-ready", {
      detail: {
        region: state.activeRegion || null,
        destination: state.destination.primary || state.destination.label || null,
        mappedParking: rows.length,
        radiusKm,
        requestedStayMinutes: window.WBSessionRules?.requestedStayMinutes?.() ?? null,
        liveAvailabilityRecords: rows.filter(({ item }) => item.available != null).length
      }
    }));
  }

  function wrapCurrentData() {
    if (typeof currentData !== "function" || currentData.__wbDestinationFocusWrapped) return;
    const baseCurrentData = currentData;
    const wrapped = function whiteblockFocusedCurrentData() {
      let data = baseCurrentData();
      const ids = state.destinationParkingFocusIds;
      if (!(ids instanceof Set) || !ids.size || !state.destination) return data;
      data = data.filter(item => ids.has(item.id));
      if (state.filter === "closest") {
        data.sort((a, b) =>
          (state.destinationParkingDistances.get(a.id) ?? Infinity)
          - (state.destinationParkingDistances.get(b.id) ?? Infinity)
        );
      }
      return data;
    };
    wrapped.__wbDestinationFocusWrapped = true;
    currentData = wrapped;
  }

  function wrapDestinationContext() {
    if (typeof applyDestinationContext !== "function" || applyDestinationContext.__wbDestinationFocusWrapped) return;
    const baseApplyDestinationContext = applyDestinationContext;
    const wrapped = function whiteblockFocusedDestinationContext(...args) {
      state.destinationParkingFocusIds = new Set();
      state.destinationParkingDistances = new Map();
      removeFocusLayer();
      const result = baseApplyDestinationContext.apply(this, args);
      window.setTimeout(focusDestinationParking, 90);
      return result;
    };
    wrapped.__wbDestinationFocusWrapped = true;
    applyDestinationContext = wrapped;
  }

  function install() {
    registerCuratedDestinations();
    prioritiseCuratedSuggestions();
    wrapCurrentData();
    wrapDestinationContext();
  }

  install();
  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(focusDestinationParking, 110));
  document.addEventListener("whiteblock:kildare-attributes-ready", () => window.setTimeout(focusDestinationParking, 110));
  document.addEventListener("whiteblock:dublin-venue-knowledge-ready", () => window.setTimeout(focusDestinationParking, 110));
  document.addEventListener("whiteblock:inventory-map-ready", () => window.setTimeout(focusDestinationParking, 80));
  document.getElementById("duration")?.addEventListener("change", () => window.setTimeout(focusDestinationParking, 90));
  document.getElementById("arrival")?.addEventListener("change", () => window.setTimeout(focusDestinationParking, 90));
})();
