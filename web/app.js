let parkingData = [];

const IRELAND_BOUNDS = [[51.2, -11.0], [55.5, -5.3]];
const CORK_CENTER = { lat: 51.8985, lng: -8.4756 };
const CORK_PILOT_RADIUS_KM = 25;

const coverageAreas = [
  { name: "Cork", lat: 51.8985, lng: -8.4756, status: "live", label: "Pilot intelligence live" },
  { name: "Dublin", lat: 53.3498, lng: -6.2603, status: "next", label: "Next expansion" },
  { name: "Galway", lat: 53.2707, lng: -9.0568, status: "planned", label: "Planned" },
  { name: "Limerick", lat: 52.6638, lng: -8.6267, status: "planned", label: "Planned" },
  { name: "Waterford", lat: 52.2593, lng: -7.1101, status: "planned", label: "Planned" }
];

const fallbackPlaces = [
  { primary: "Cork City Centre", secondary: "Cork, County Cork, Ireland", label: "Cork City Centre, Cork, Ireland", lat: 51.8985, lng: -8.4756, type: "city", source: "WHITEBLOCK fallback" },
  { primary: "Mahon Point Shopping Centre", secondary: "Mahon, Cork, Ireland", label: "Mahon Point Shopping Centre, Cork, Ireland", lat: 51.8866, lng: -8.3997, type: "poi", source: "WHITEBLOCK fallback" },
  { primary: "Dublin City Centre", secondary: "Dublin, Ireland", label: "Dublin City Centre, Dublin, Ireland", lat: 53.3498, lng: -6.2603, type: "city", source: "WHITEBLOCK fallback" },
  { primary: "Trinity College Dublin", secondary: "College Green, Dublin, Ireland", label: "Trinity College Dublin, College Green, Dublin, Ireland", lat: 53.3438, lng: -6.2546, type: "poi", source: "WHITEBLOCK fallback" },
  { primary: "Dublin Airport", secondary: "Collinstown, County Dublin, Ireland", label: "Dublin Airport, County Dublin, Ireland", lat: 53.4264, lng: -6.2499, type: "airport", source: "WHITEBLOCK fallback" },
  { primary: "Eyre Square", secondary: "Galway, Ireland", label: "Eyre Square, Galway, Ireland", lat: 53.2740, lng: -9.0490, type: "poi", source: "WHITEBLOCK fallback" },
  { primary: "Limerick City Centre", secondary: "Limerick, Ireland", label: "Limerick City Centre, Limerick, Ireland", lat: 52.6638, lng: -8.6267, type: "city", source: "WHITEBLOCK fallback" },
  { primary: "Waterford City Centre", secondary: "Waterford, Ireland", label: "Waterford City Centre, Waterford, Ireland", lat: 52.2593, lng: -7.1101, type: "city", source: "WHITEBLOCK fallback" },
  { primary: "Kilkenny Castle", secondary: "The Parade, Kilkenny, Ireland", label: "Kilkenny Castle, Kilkenny, Ireland", lat: 52.6506, lng: -7.2492, type: "poi", source: "WHITEBLOCK fallback" },
  { primary: "Killarney Town Centre", secondary: "Killarney, County Kerry, Ireland", label: "Killarney Town Centre, Killarney, Ireland", lat: 52.0599, lng: -9.5044, type: "town", source: "WHITEBLOCK fallback" }
];

const initialDestination = fallbackPlaces[0];

const state = {
  filter: "best",
  selectedId: null,
  map: null,
  markers: new Map(),
  destination: initialDestination,
  destinationMarker: null,
  coverageLayer: null,
  suggestions: [],
  activeSuggestionIndex: -1,
  suggestionTimer: null,
  suggestionController: null,
  committedDestinationLabel: initialDestination.label
};

const viewTitles = {
  find: "Find the best place to park.",
  discover: "Discover hidden parking supply.",
  network: "Optimise the parking network.",
  evidence: "Trust every recommendation."
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function availabilityLabel(item) {
  if (item.available == null || item.capacity == null || item.capacity <= 0) return { text: "Unknown", marker: "marker-mid" };
  const ratio = item.available / item.capacity;
  if (ratio >= 0.25) return { text: "Good", marker: "marker-good" };
  if (ratio >= 0.12) return { text: "Moderate", marker: "marker-mid" };
  return { text: "Pressure", marker: "marker-pressure" };
}

function score(item) {
  const availability = item.available != null && item.capacity > 0 ? item.available / item.capacity : 0;
  const walkPenalty = (item.walk ?? 60) / 60;
  const pricePenalty = item.price != null ? item.price / 10 : 0;
  const confidence = (item.confidence ?? 0) / 100;
  return availability * 0.42 + confidence * 0.3 - walkPenalty * 0.18 - pricePenalty * 0.1;
}

function currentData() {
  let data = [...parkingData];
  if (state.filter === "closest") data.sort((a, b) => (a.walk ?? Infinity) - (b.walk ?? Infinity));
  else if (state.filter === "cheapest") data.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else if (state.filter === "accessible") data = data.filter(item => item.accessible);
  else if (state.filter === "ev") data = data.filter(item => item.ev);
  else data.sort((a, b) => score(b) - score(a));
  return data;
}

function parkingCard(item, index) {
  const availability = availabilityLabel(item);
  const selected = item.id === state.selectedId ? " selected" : "";
  const price = item.price != null ? `€${Number(item.price).toFixed(2)}` : "—";
  return `
    <article class="parking-card surface${selected}" data-parking-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.name)} on map">
      <div class="parking-top">
        <div class="parking-rank">
          <span class="rank">${String(index + 1).padStart(2, "0")}</span>
          <div class="parking-title">
            <h3>${escapeHtml(item.name)}</h3>
            <small>${escapeHtml(item.area || "Cork")} · ${escapeHtml(item.id.replace("WB-PARK-IE-CORK-", "WB-"))}</small>
          </div>
        </div>
        <div class="availability">
          <strong>${availability.text}</strong>
          <small>${item.available != null ? `${item.available} spaces` : "availability unknown"}</small>
        </div>
      </div>
      <div class="parking-meta">
        <span>Walk<b>${item.walk != null ? `${item.walk} min` : "—"}</b></span>
        <span>Est. cost<b>${price}</b></span>
        <span>Confidence<b>${item.confidence ?? "—"}%</b></span>
      </div>
      <p class="reason"><strong>Why:</strong> ${escapeHtml(item.reason || "Evidence-backed parking record")}</p>
    </article>`;
}

function renderParkingList() {
  const list = document.getElementById("parking-list");
  if (!list) return;

  const inPilot = !state.destination || isInCorkPilot(state.destination.lat, state.destination.lng);
  const count = document.querySelector(".result-count");
  const coverageMessage = document.getElementById("coverage-message");

  if (!inPilot && state.destination) {
    list.innerHTML = "";
    if (count) count.textContent = "Pilot only";
    if (coverageMessage) {
      coverageMessage.hidden = false;
      coverageMessage.innerHTML = `
        <span class="coverage-kicker">Destination found</span>
        <h3>${escapeHtml(state.destination.primary || state.destination.label)}</h3>
        <p>WHITEBLOCK can locate this destination on the Ireland map, but evidence-backed parking recommendations are currently connected only for the Cork pilot.</p>
        <button type="button" id="return-cork-button">View Cork pilot</button>`;
      document.getElementById("return-cork-button")?.addEventListener("click", () => selectAddressSuggestion(initialDestination, { runRanking: true }));
    }
    return;
  }

  if (coverageMessage) coverageMessage.hidden = true;
  const data = currentData();
  list.innerHTML = data.map(parkingCard).join("");
  if (count) count.textContent = `${data.length} found`;

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
}

function markerHtml(item) {
  const availability = availabilityLabel(item);
  return `<div class="map-marker ${availability.marker}"><strong>${item.available != null ? Math.round(item.available) : "?"}</strong></div>`;
}

function destinationIcon() {
  return L.divIcon({ className: "wb-destination-wrapper", html: '<div class="destination-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 20] });
}

function addOrMoveDestinationMarker(destination) {
  if (!state.map || !destination) return;
  if (state.destinationMarker) state.map.removeLayer(state.destinationMarker);
  state.destinationMarker = L.marker([destination.lat, destination.lng], { icon: destinationIcon(), zIndexOffset: 1000 }).addTo(state.map);
  state.destinationMarker.bindTooltip(destination.primary || destination.label, { direction: "top", offset: [0, -16], className: "wb-tooltip" });
}

function clearCoverageLayer() {
  if (state.map && state.coverageLayer) {
    state.map.removeLayer(state.coverageLayer);
    state.coverageLayer = null;
  }
}

function renderCoverageLayer() {
  if (!state.map) return;
  clearCoverageLayer();
  state.coverageLayer = L.layerGroup().addTo(state.map);

  coverageAreas.forEach(area => {
    const icon = L.divIcon({
      className: "wb-coverage-wrapper",
      html: `<div class="coverage-node ${area.status}"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    const marker = L.marker([area.lat, area.lng], { icon }).addTo(state.coverageLayer);
    marker.bindTooltip(`${area.name} · ${area.label}`, { direction: "top", offset: [0, -8], className: "wb-tooltip" });
  });
}

function setMapStatus(title, copy) {
  const titleEl = document.getElementById("map-status-title");
  const copyEl = document.getElementById("map-status-copy");
  if (titleEl) titleEl.textContent = title;
  if (copyEl) copyEl.textContent = copy;
}

function setKpiMode(inPilot) {
  const values = inPilot ? {
    coverage: ["—", "loading Cork parking inventory"],
    availability: ["—", "loading latest observations"],
    confidence: ["—", "calculating evidence confidence"],
    pressure: ["—", "awaiting observation data"]
  } : {
    coverage: ["Ireland", "destination search enabled"],
    availability: ["—", "parking feed not connected here yet"],
    confidence: ["—", "awaiting local evidence sources"],
    pressure: ["Planned", "regional rollout required"]
  };

  [["coverage", values.coverage], ["availability", values.availability], ["confidence", values.confidence], ["pressure", values.pressure]].forEach(([key, value]) => {
    const valueEl = document.getElementById(`kpi-${key}-value`);
    const copyEl = document.getElementById(`kpi-${key}-copy`);
    if (valueEl) valueEl.textContent = value[0];
    if (copyEl) copyEl.textContent = value[1];
  });
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") {
    if (mapEl) mapEl.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#8FA39A;font-size:12px">Map layer unavailable · parking list remains usable</div>';
    return;
  }

  state.map = L.map("map", { zoomControl: true, attributionControl: true }).setView([CORK_CENTER.lat, CORK_CENTER.lng], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);

  parkingData.forEach(item => {
    const icon = L.divIcon({
      className: "wb-marker-wrapper",
      html: markerHtml(item),
      iconSize: [34, 34],
      iconAnchor: [17, 30]
    });
    const marker = L.marker([item.lat, item.lng], { icon }).addTo(state.map);
    marker.bindTooltip(`${item.name} · ${item.available ?? "?"} spaces`, {
      direction: "top",
      offset: [0, -22],
      className: "wb-tooltip"
    });
    marker.on("click", () => selectParking(item.id));
    state.markers.set(item.id, marker);
  });

  addOrMoveDestinationMarker(initialDestination);
}

function selectParking(id) {
  state.selectedId = id;
  renderParkingList();
  const item = parkingData.find(entry => entry.id === id);
  if (item && state.map) {
    clearCoverageLayer();
    state.map.flyTo([item.lat, item.lng], 15, { duration: 0.65 });
    const marker = state.markers.get(id);
    if (marker) marker.openTooltip();
  }
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".chip").forEach(chip => chip.classList.toggle("active", chip.dataset.filter === filter));
  const data = currentData();
  if (data.length && !data.some(item => item.id === state.selectedId)) state.selectedId = data[0].id;
  renderParkingList();
}

function setView(view) {
  document.querySelectorAll("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  const title = document.getElementById("view-title");
  if (title) title.textContent = viewTitles[view] || viewTitles.find;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "find" && state.map) setTimeout(() => state.map.invalidateSize(), 80);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInCorkPilot(lat, lng) {
  return haversineKm(lat, lng, CORK_CENTER.lat, CORK_CENTER.lng) <= CORK_PILOT_RADIUS_KM;
}

function uniqueParts(parts) {
  const seen = new Set();
  return parts.filter(part => {
    const clean = String(part || "").trim();
    if (!clean) return false;
    const key = clean.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function featureToSuggestion(feature) {
  const props = feature?.properties || {};
  const coords = feature?.geometry?.coordinates || [];
  if (!Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return null;

  const streetLine = uniqueParts([props.housenumber, props.street]).join(" ");
  const primary = props.name || streetLine || props.street || props.city || props.town || props.village || props.locality || "Irish destination";
  const secondaryParts = uniqueParts([
    streetLine && primary !== streetLine ? streetLine : null,
    props.district,
    props.city || props.town || props.village,
    props.county,
    props.postcode,
    props.country || "Ireland"
  ]).filter(part => part.toLowerCase() !== String(primary).toLowerCase());
  const secondary = secondaryParts.join(", ");
  const label = uniqueParts([primary, ...secondaryParts]).join(", ");

  return {
    primary,
    secondary,
    label,
    lat: Number(coords[1]),
    lng: Number(coords[0]),
    type: props.type || props.osm_value || "place",
    source: "Photon / OpenStreetMap"
  };
}

function localSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return fallbackPlaces.filter(place => `${place.primary} ${place.secondary}`.toLowerCase().includes(normalized));
}

async function fetchAddressSuggestions(query) {
  const clean = query.trim();
  if (clean.length < 2) return [];

  if (state.suggestionController) state.suggestionController.abort();
  state.suggestionController = new AbortController();

  const fallback = localSuggestions(clean);

  try {
    const params = new URLSearchParams({
      q: clean,
      limit: "8",
      lang: "en",
      bbox: "-11.0,51.2,-5.3,55.5",
      lat: "53.35",
      lon: "-8.0"
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      signal: state.suggestionController.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

    const payload = await response.json();
    const online = (payload.features || [])
      .filter(feature => {
        const props = feature.properties || {};
        const code = String(props.countrycode || props.country_code || "").toUpperCase();
        return code === "IE" || String(props.country || "").toLowerCase() === "ireland";
      })
      .map(featureToSuggestion)
      .filter(Boolean);

    const merged = [];
    const seen = new Set();
    [...online, ...fallback].forEach(item => {
      const key = `${item.label.toLowerCase()}|${item.lat.toFixed(4)}|${item.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    });
    return merged.slice(0, 8);
  } catch (error) {
    if (error.name === "AbortError") return [];
    return fallback.slice(0, 8);
  }
}

function suggestionIcon(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("airport")) return "✈";
  if (value.includes("city") || value.includes("town") || value.includes("village")) return "⌂";
  if (value.includes("house") || value.includes("street")) return "⌖";
  return "◇";
}

function renderSuggestions(items, statusMessage = "") {
  const box = document.getElementById("destination-suggestions");
  const input = document.getElementById("destination");
  if (!box || !input) return;

  state.suggestions = items;
  state.activeSuggestionIndex = -1;

  if (statusMessage) {
    box.innerHTML = `<div class="suggestion-status">${escapeHtml(statusMessage)}</div>`;
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
    return;
  }

  if (!items.length) {
    box.innerHTML = '<div class="suggestion-status">No Irish address or place found. Try a nearby landmark, street or town.</div>';
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
    return;
  }

  box.innerHTML = items.map((item, index) => `
    <button type="button" class="address-suggestion" role="option" data-suggestion-index="${index}" id="destination-option-${index}">
      <span class="suggestion-icon">${suggestionIcon(item.type)}</span>
      <span class="suggestion-copy"><strong>${escapeHtml(item.primary)}</strong><small>${escapeHtml(item.secondary || "Ireland")}</small></span>
      <span class="suggestion-type">${escapeHtml(item.type || "place")}</span>
    </button>`).join("");

  box.hidden = false;
  input.setAttribute("aria-expanded", "true");

  box.querySelectorAll(".address-suggestion").forEach(button => {
    button.addEventListener("click", () => {
      const item = state.suggestions[Number(button.dataset.suggestionIndex)];
      if (item) selectAddressSuggestion(item);
    });
  });
}

function hideSuggestions() {
  const box = document.getElementById("destination-suggestions");
  const input = document.getElementById("destination");
  if (box) box.hidden = true;
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  state.activeSuggestionIndex = -1;
}

function updateActiveSuggestion(index) {
  const input = document.getElementById("destination");
  const buttons = [...document.querySelectorAll(".address-suggestion")];
  if (!buttons.length || !input) return;

  const safeIndex = ((index % buttons.length) + buttons.length) % buttons.length;
  state.activeSuggestionIndex = safeIndex;
  buttons.forEach((button, i) => button.classList.toggle("active", i === safeIndex));
  input.setAttribute("aria-activedescendant", `destination-option-${safeIndex}`);
  buttons[safeIndex].scrollIntoView({ block: "nearest" });
}

function scheduleSuggestions(query) {
  clearTimeout(state.suggestionTimer);
  if (query.trim().length < 2) {
    hideSuggestions();
    return;
  }

  renderSuggestions([], "Searching Ireland…");
  state.suggestionTimer = setTimeout(async () => {
    const items = await fetchAddressSuggestions(query);
    const input = document.getElementById("destination");
    if (!input || input.value.trim() !== query.trim()) return;
    renderSuggestions(items);
  }, 420);
}

function applyDestinationContext({ runRanking = false } = {}) {
  if (!state.destination) return;

  clearCoverageLayer();
  addOrMoveDestinationMarker(state.destination);
  const inPilot = isInCorkPilot(state.destination.lat, state.destination.lng);
  setKpiMode(inPilot);
  renderParkingList();

  const mapTitle = document.getElementById("map-title");
  if (mapTitle) mapTitle.textContent = inPilot ? "Parking around your destination" : "Destination located in Ireland";

  if (state.map) {
    state.map.flyTo([state.destination.lat, state.destination.lng], inPilot ? 14 : 13, { duration: 0.7 });
    state.destinationMarker?.openTooltip();
  }

  if (inPilot) {
    setMapStatus("Cork parking intelligence", state.dataStatus === "ready" ? "Official parking snapshot ranked for this destination" : "Loading official parking data");
  } else {
    setMapStatus("Ireland destination search", "Parking intelligence for this area is not connected yet");
  }

  if (runRanking) {
    const title = document.getElementById("view-title");
    if (title) {
      title.textContent = inPilot
        ? `Best parking for ${state.destination.primary}.`
        : `${state.destination.primary} found — regional parking layer pending.`;
    }
  }
}

function selectAddressSuggestion(item, { runRanking = false } = {}) {
  state.destination = item;
  state.committedDestinationLabel = item.label;
  const input = document.getElementById("destination");
  if (input) input.value = item.label;
  hideSuggestions();
  applyDestinationContext({ runRanking });
}

async function resolveTypedDestination() {
  const input = document.getElementById("destination");
  const query = input?.value.trim() || "";
  if (!query) return null;

  if (state.destination && query === state.committedDestinationLabel) return state.destination;
  if (state.destination && query === state.destination.primary) return state.destination;

  const suggestions = await fetchAddressSuggestions(query);
  const first = suggestions[0] || null;
  if (first) selectAddressSuggestion(first);
  return first;
}

async function runSearch() {
  const button = document.getElementById("search-button");
  if (!button) return;

  const previous = button.innerHTML;
  button.innerHTML = "Locating…";
  button.disabled = true;

  const destination = await resolveTypedDestination();
  if (!destination) {
    button.innerHTML = "Choose a destination";
    const input = document.getElementById("destination");
    if (input?.value.trim().length >= 2) {
      const items = await fetchAddressSuggestions(input.value.trim());
      renderSuggestions(items);
    }
    setTimeout(() => {
      button.innerHTML = previous;
      button.disabled = false;
    }, 1100);
    return;
  }

  button.innerHTML = "Ranking options…";
  setTimeout(() => {
    applyDestinationContext({ runRanking: true });
    button.innerHTML = "Updated <span>✓</span>";
    setTimeout(() => {
      button.innerHTML = previous;
      button.disabled = false;
    }, 850);
  }, 420);
}

function showIrelandOverview() {
  if (!state.map) return;
  renderCoverageLayer();
  state.map.fitBounds(IRELAND_BOUNDS, { padding: [18, 18] });
  const mapTitle = document.getElementById("map-title");
  if (mapTitle) mapTitle.textContent = "WHITEBLOCK across Ireland";
  setMapStatus("Ireland Coverage View", "Cork pilot · Dublin next · Galway/Limerick/Waterford planned");
}

function initAddressSearch() {
  const input = document.getElementById("destination");
  if (!input) return;

  input.addEventListener("input", () => {
    const value = input.value;
    if (value !== state.committedDestinationLabel && value !== state.destination?.primary) state.destination = null;
    scheduleSuggestions(value);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 2) scheduleSuggestions(input.value);
  });

  input.addEventListener("blur", () => setTimeout(hideSuggestions, 170));

  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveSuggestion(state.activeSuggestionIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveSuggestion(state.activeSuggestionIndex - 1);
    } else if (event.key === "Enter") {
      if (state.activeSuggestionIndex >= 0 && state.suggestions[state.activeSuggestionIndex]) {
        event.preventDefault();
        selectAddressSuggestion(state.suggestions[state.activeSuggestionIndex]);
      } else {
        event.preventDefault();
        runSearch();
      }
    } else if (event.key === "Escape") {
      hideSuggestions();
    }
  });
}

function initNavigation() {
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => setFilter(chip.dataset.filter)));
  document.getElementById("search-button")?.addEventListener("click", runSearch);
  document.getElementById("ireland-overview-button")?.addEventListener("click", showIrelandOverview);

  document.querySelectorAll(".mode").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode").forEach(mode => mode.classList.toggle("active", mode === button));
      setView(button.dataset.mode === "intelligence" ? "network" : "find");
    });
  });
}

renderParkingList();
initNavigation();
initAddressSearch();
initMap();
