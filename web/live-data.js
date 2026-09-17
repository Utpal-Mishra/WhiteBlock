// WHITEBLOCK live-data adapter for the static GitHub Pages application.
// The Pages build generates ./data/parking_snapshot.json from the authoritative
// Cork ingestion pipeline. No database credentials are exposed to the browser.

(() => {
  const SNAPSHOT_URL = "./data/parking_snapshot.json";
  const NEARBY_RADIUS_KM = 10;
  const MAX_RESULTS = 8;

  state.dataStatus = "loading";
  state.parkingSnapshot = null;

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function priceNumber(raw) {
    if (!raw) return null;
    const match = String(raw).match(/€\s*([0-9]+(?:[.,][0-9]+)?)/i);
    if (!match) return null;
    return Number(match[1].replace(",", "."));
  }

  function priceLabel(item) {
    if (item.pricingRaw) return item.pricingRaw;
    return "Tariff not published";
  }

  function freshnessLabel(value) {
    if (!value) return "unknown freshness";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "unknown freshness";
    const minutes = Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
    if (minutes < 2) return "updated just now";
    if (minutes < 60) return `updated ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `updated ${hours}h ago`;
    return `updated ${Math.round(hours / 24)}d ago`;
  }

  function estimateWalkMinutes(distanceKm) {
    if (!Number.isFinite(distanceKm)) return null;
    const routeFactor = 1.22;
    const walkingSpeedKmh = 4.8;
    return Math.max(1, Math.round((distanceKm * routeFactor / walkingSpeedKmh) * 60));
  }

  function hydrate(record) {
    const confidence = Math.round((numeric(record?.confidence?.score) ?? 0.7) * 100);
    const item = {
      id: record.parking_id,
      name: record.name || record.parking_id,
      area: "Cork",
      lat: numeric(record.latitude),
      lng: numeric(record.longitude),
      available: numeric(record.available_spaces),
      capacity: numeric(record.capacity),
      occupancyRatio: numeric(record.occupancy_ratio),
      confidence,
      confidenceBasis: record?.confidence?.basis || {},
      accessible: numeric(record.accessible_spaces) > 0 ? true : null,
      ev: numeric(record.ev_spaces) > 0 ? true : null,
      pricingRaw: record.pricing_raw || null,
      openingHoursRaw: record.opening_hours_raw || null,
      heightRestrictionRaw: record.height_restriction_raw || null,
      observedAt: record.observed_at || null,
      retrievedAt: record.retrieved_at || null,
      truthState: record.truth_state || "observed",
      sourceKey: record.source_key || "cork_city_parking_live",
      distanceKm: null,
      walk: null,
      price: priceNumber(record.pricing_raw),
      reason: ""
    };
    return item;
  }

  function withDestinationMetrics(item) {
    const clone = { ...item };
    if (state.destination && Number.isFinite(clone.lat) && Number.isFinite(clone.lng)) {
      clone.distanceKm = haversineKm(state.destination.lat, state.destination.lng, clone.lat, clone.lng);
      clone.walk = estimateWalkMinutes(clone.distanceKm);
    }

    const observed = clone.available != null && clone.capacity != null
      ? `${Math.round(clone.available)} of ${Math.round(clone.capacity)} spaces reported free`
      : "availability is not currently reported";
    const distance = clone.distanceKm != null
      ? `${clone.distanceKm.toFixed(1)} km from the selected destination`
      : "distance pending";
    clone.reason = `${observed}; ${distance}. Confidence is evidence-derived from source quality, freshness and field completeness.`;
    return clone;
  }

  function unfilteredNearbyData() {
    const data = parkingData
      .map(withDestinationMetrics)
      .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    if (!state.destination) return data;
    return data.filter(item => item.distanceKm != null && item.distanceKm <= NEARBY_RADIUS_KM);
  }

  availabilityLabel = function availabilityLabelLive(item) {
    if (item.available == null || item.capacity == null || item.capacity <= 0) {
      return { text: "Unknown", marker: "marker-mid" };
    }
    const ratio = item.available / item.capacity;
    if (ratio >= 0.25) return { text: "Good", marker: "marker-good" };
    if (ratio >= 0.12) return { text: "Moderate", marker: "marker-mid" };
    return { text: "Pressure", marker: "marker-pressure" };
  };

  score = function scoreLive(item) {
    const availability = item.available != null && item.capacity > 0 ? item.available / item.capacity : 0.3;
    const distance = item.distanceKm != null ? Math.max(0, 1 - item.distanceKm / NEARBY_RADIUS_KM) : 0.2;
    const confidence = item.confidence / 100;
    const price = item.price != null ? Math.max(0, 1 - item.price / 10) : 0.4;
    return availability * 0.40 + distance * 0.35 + confidence * 0.20 + price * 0.05;
  };

  currentData = function currentLiveData() {
    let data = unfilteredNearbyData();

    if (state.filter === "closest") data.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    else if (state.filter === "cheapest") data.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (state.filter === "accessible") data = data.filter(item => item.accessible === true);
    else if (state.filter === "ev") data = data.filter(item => item.ev === true);
    else data.sort((a, b) => score(b) - score(a));

    return data.slice(0, MAX_RESULTS);
  };

  parkingCard = function parkingCardLive(item, index) {
    const availability = availabilityLabel(item);
    const selected = item.id === state.selectedId ? " selected" : "";
    const availabilityCopy = item.available != null ? `${Math.round(item.available)} spaces` : "availability unknown";
    const distance = item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : "—";
    const walk = item.walk != null ? `~${item.walk} min` : "—";
    const observed = freshnessLabel(item.observedAt || item.retrievedAt);

    return `
      <article class="parking-card surface${selected}" data-parking-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.name)} on map">
        <div class="parking-top">
          <div class="parking-rank">
            <span class="rank">${String(index + 1).padStart(2, "0")}</span>
            <div class="parking-title">
              <h3>${escapeHtml(item.name)}</h3>
              <small>${escapeHtml(item.area)} · ${escapeHtml(item.id.replace("WB-PARK-IE-CORK-", "WB-"))}</small>
            </div>
          </div>
          <div class="availability">
            <strong>${escapeHtml(availability.text)}</strong>
            <small>${escapeHtml(availabilityCopy)}</small>
          </div>
        </div>
        <div class="parking-meta">
          <span>Distance<b>${escapeHtml(distance)}</b></span>
          <span>Est. walk<b>${escapeHtml(walk)}</b></span>
          <span>Confidence<b>${item.confidence}%</b></span>
        </div>
        <p class="reason"><strong>Price:</strong> ${escapeHtml(priceLabel(item))}</p>
        <p class="reason"><strong>Why:</strong> ${escapeHtml(item.reason)}</p>
        <p class="reason"><strong>Evidence:</strong> ${escapeHtml(item.truthState)} · ${escapeHtml(observed)}</p>
      </article>`;
  };

  renderParkingList = function renderLiveParkingList() {
    const list = document.getElementById("parking-list");
    if (!list) return;

    const count = document.querySelector(".result-count");
    const coverageMessage = document.getElementById("coverage-message");
    const inPilot = !state.destination || isInCorkPilot(state.destination.lat, state.destination.lng);

    if (state.dataStatus === "loading") {
      list.innerHTML = "";
      if (count) count.textContent = "Loading";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        coverageMessage.innerHTML = '<span class="coverage-kicker">Official data</span><h3>Loading Cork parking inventory…</h3><p>WHITEBLOCK is loading the latest published Cork parking snapshot.</p>';
      }
      return;
    }

    if (state.dataStatus === "error") {
      list.innerHTML = "";
      if (count) count.textContent = "Unavailable";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        coverageMessage.innerHTML = '<span class="coverage-kicker">Data unavailable</span><h3>Parking feed could not be loaded.</h3><p>WHITEBLOCK will not substitute demo parking values. Try refreshing after the next data publication.</p>';
      }
      return;
    }

    if (!inPilot && state.destination) {
      list.innerHTML = "";
      if (count) count.textContent = "Pilot only";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        coverageMessage.innerHTML = `
          <span class="coverage-kicker">Destination found</span>
          <h3>${escapeHtml(state.destination.primary || state.destination.label)}</h3>
          <p>WHITEBLOCK can locate this destination, but evidence-backed parking inventory is currently connected only for the Cork pilot.</p>
          <button type="button" id="return-cork-button">View Cork pilot</button>`;
        document.getElementById("return-cork-button")?.addEventListener("click", () => selectAddressSuggestion(initialDestination, { runRanking: true }));
      }
      return;
    }

    const data = currentData();
    if (!data.length) {
      list.innerHTML = "";
      if (count) count.textContent = "0 nearby";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        const filterMessage = state.filter === "accessible" || state.filter === "ev"
          ? "The official pilot feed does not currently expose enough structured data for this filter at nearby assets."
          : `No published Cork parking asset is within ${NEARBY_RADIUS_KM} km of this destination in the current snapshot.`;
        coverageMessage.innerHTML = `<span class="coverage-kicker">No supported result</span><h3>No matching parking found</h3><p>${escapeHtml(filterMessage)}</p>`;
      }
      return;
    }

    if (coverageMessage) coverageMessage.hidden = true;
    list.innerHTML = data.map(parkingCard).join("");
    if (count) count.textContent = `${data.length} nearby`;

    if (!data.some(item => item.id === state.selectedId)) state.selectedId = data[0].id;

    list.querySelectorAll(".parking-card").forEach(card => {
      const select = () => selectParking(card.dataset.parkingId);
      card.addEventListener("click", select);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });
    });
  };

  setKpiMode = function setLiveKpiMode(inPilot) {
    let values;

    if (!inPilot) {
      values = {
        coverage: ["Ireland", "destination search enabled"],
        availability: ["—", "parking feed not connected here yet"],
        confidence: ["—", "awaiting local evidence sources"],
        pressure: ["Planned", "regional rollout required"]
      };
    } else if (state.dataStatus !== "ready") {
      values = {
        coverage: ["—", "loading official Cork inventory"],
        availability: ["—", "loading latest observation"],
        confidence: ["—", "calculating evidence confidence"],
        pressure: ["—", "awaiting observation data"]
      };
    } else {
      const nearby = unfilteredNearbyData();
      const available = nearby.map(item => item.available).filter(value => value != null);
      const confidences = nearby.map(item => item.confidence).filter(Number.isFinite);
      const occupied = nearby.reduce((sum, item) => sum + (item.capacity != null && item.available != null ? Math.max(0, item.capacity - item.available) : 0), 0);
      const capacity = nearby.reduce((sum, item) => sum + (item.capacity ?? 0), 0);
      const occupancy = capacity > 0 ? occupied / capacity : null;
      const pressure = occupancy == null ? "Unknown" : occupancy >= 0.85 ? "High" : occupancy >= 0.65 ? "Moderate" : "Low";
      const sourceTime = state.parkingSnapshot?.source?.retrieved_at || state.parkingSnapshot?.generated_at;

      values = {
        coverage: [`${nearby.length}`, `official parking assets within ${NEARBY_RADIUS_KM} km`],
        availability: [available.length ? String(Math.round(available.reduce((a, b) => a + b, 0))) : "—", freshnessLabel(sourceTime)],
        confidence: [confidences.length ? `${Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)}%` : "—", "source + freshness + completeness"],
        pressure: [pressure, occupancy == null ? "insufficient occupancy data" : `${Math.round(occupancy * 100)}% observed occupancy`]
      };
    }

    [["coverage", values.coverage], ["availability", values.availability], ["confidence", values.confidence], ["pressure", values.pressure]].forEach(([key, value]) => {
      const valueEl = document.getElementById(`kpi-${key}-value`);
      const copyEl = document.getElementById(`kpi-${key}-copy`);
      if (valueEl) valueEl.textContent = value[0];
      if (copyEl) copyEl.textContent = value[1];
    });
  };

  function rebuildMapMarkers() {
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
      const availability = item.available != null ? `${Math.round(item.available)} spaces reported free` : "availability unknown";
      marker.bindTooltip(`${item.name} · ${availability}`, { direction: "top", offset: [0, -22], className: "wb-tooltip" });
      marker.on("click", () => selectParking(item.id));
      state.markers.set(item.id, marker);
    });
  }

  async function loadSnapshot() {
    setKpiMode(isInCorkPilot(state.destination.lat, state.destination.lng));
    renderParkingList();

    try {
      const response = await fetch(`${SNAPSHOT_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`parking snapshot returned ${response.status}`);
      const snapshot = await response.json();
      if (!snapshot || !Array.isArray(snapshot.locations)) throw new Error("invalid parking snapshot");

      parkingData = snapshot.locations.map(hydrate).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      state.parkingSnapshot = snapshot;
      state.dataStatus = "ready";
      state.selectedId = parkingData[0]?.id || null;

      rebuildMapMarkers();
      setKpiMode(isInCorkPilot(state.destination.lat, state.destination.lng));
      renderParkingList();

      const sourceTime = snapshot?.source?.retrieved_at || snapshot.generated_at;
      setMapStatus("Cork official parking data", `${parkingData.length} assets · ${freshnessLabel(sourceTime)}`);
      document.dispatchEvent(new CustomEvent("whiteblock:data-ready", { detail: { locations: parkingData.length } }));
    } catch (error) {
      console.error("WHITEBLOCK parking snapshot load failed", error);
      parkingData = [];
      state.parkingSnapshot = null;
      state.dataStatus = "error";
      state.selectedId = null;
      rebuildMapMarkers();
      setKpiMode(isInCorkPilot(state.destination.lat, state.destination.lng));
      renderParkingList();
      setMapStatus("Parking data unavailable", "No demo availability values are being substituted");
    }
  }

  loadSnapshot();
})();
