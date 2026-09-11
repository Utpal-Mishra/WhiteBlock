const parkingData = [
  {
    id: "WB-PARK-IE-CORK-000021",
    name: "City Centre West",
    area: "Central Cork",
    lat: 51.8977,
    lng: -8.4757,
    available: 68,
    capacity: 420,
    walk: 4,
    price: 5.8,
    confidence: 96,
    accessible: true,
    ev: true,
    reason: "Strong availability with a short walk and current authoritative coverage."
  },
  {
    id: "WB-PARK-IE-CORK-000034",
    name: "River Quarter",
    area: "North channel",
    lat: 51.9011,
    lng: -8.4702,
    available: 74,
    capacity: 172,
    walk: 7,
    price: 4.2,
    confidence: 88,
    accessible: true,
    ev: false,
    reason: "Lower utilisation makes this the strongest pressure-relief option in the demo network."
  },
  {
    id: "WB-PARK-IE-CORK-000008",
    name: "South Mall",
    area: "South city centre",
    lat: 51.8957,
    lng: -8.4728,
    available: 31,
    capacity: 132,
    walk: 3,
    price: 6.4,
    confidence: 93,
    accessible: true,
    ev: true,
    reason: "Closest high-confidence option, but projected demand pressure is higher."
  },
  {
    id: "WB-PARK-IE-CORK-000015",
    name: "North Gate",
    area: "North city centre",
    lat: 51.9002,
    lng: -8.4789,
    available: 41,
    capacity: 205,
    walk: 9,
    price: 3.6,
    confidence: 90,
    accessible: false,
    ev: false,
    reason: "Lowest estimated cost with moderate availability and a longer walk."
  }
];

const state = {
  filter: "best",
  selectedId: parkingData[0].id,
  map: null,
  markers: new Map()
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
  const ratio = item.available / item.capacity;
  if (ratio >= 0.25) return { text: "Good", marker: "marker-good" };
  if (ratio >= 0.12) return { text: "Moderate", marker: "marker-mid" };
  return { text: "Pressure", marker: "marker-pressure" };
}

function score(item) {
  const availability = item.available / item.capacity;
  const walkPenalty = item.walk / 12;
  const pricePenalty = item.price / 10;
  const confidence = item.confidence / 100;
  return availability * 0.42 + confidence * 0.3 - walkPenalty * 0.18 - pricePenalty * 0.1;
}

function currentData() {
  let data = [...parkingData];
  if (state.filter === "closest") data.sort((a, b) => a.walk - b.walk);
  else if (state.filter === "cheapest") data.sort((a, b) => a.price - b.price);
  else if (state.filter === "accessible") data = data.filter(item => item.accessible);
  else if (state.filter === "ev") data = data.filter(item => item.ev);
  else data.sort((a, b) => score(b) - score(a));
  return data;
}

function parkingCard(item, index) {
  const availability = availabilityLabel(item);
  const selected = item.id === state.selectedId ? " selected" : "";
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
          <strong>${availability.text}</strong>
          <small>${item.available} spaces</small>
        </div>
      </div>
      <div class="parking-meta">
        <span>Walk<b>${item.walk} min</b></span>
        <span>Est. cost<b>€${item.price.toFixed(2)}</b></span>
        <span>Confidence<b>${item.confidence}%</b></span>
      </div>
      <p class="reason"><strong>Why:</strong> ${escapeHtml(item.reason)}</p>
    </article>`;
}

function renderParkingList() {
  const list = document.getElementById("parking-list");
  if (!list) return;
  const data = currentData();
  list.innerHTML = data.map(parkingCard).join("");
  const count = document.querySelector(".result-count");
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
  return `<div class="map-marker ${availability.marker}"><strong>${item.available}</strong></div>`;
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") {
    if (mapEl) mapEl.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#8FA39A;font-size:12px">Map layer unavailable · parking list remains usable</div>';
    return;
  }

  state.map = L.map("map", { zoomControl: true, attributionControl: true }).setView([51.8985, -8.4756], 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(state.map);

  parkingData.forEach(item => {
    const icon = L.divIcon({
      className: "wb-marker-wrapper",
      html: markerHtml(item),
      iconSize: [34, 34],
      iconAnchor: [17, 30]
    });
    const marker = L.marker([item.lat, item.lng], { icon }).addTo(state.map);
    marker.bindTooltip(`${item.name} · ${item.available} spaces`, {
      direction: "top",
      offset: [0, -22],
      className: "wb-tooltip"
    });
    marker.on("click", () => selectParking(item.id));
    state.markers.set(item.id, marker);
  });
}

function selectParking(id) {
  state.selectedId = id;
  renderParkingList();
  const item = parkingData.find(entry => entry.id === id);
  if (item && state.map) {
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

function runSearch() {
  const destination = document.getElementById("destination")?.value.trim() || "your destination";
  const button = document.getElementById("search-button");
  if (!button) return;
  const previous = button.innerHTML;
  button.innerHTML = "Ranking options…";
  button.disabled = true;
  setTimeout(() => {
    button.innerHTML = "Updated <span>✓</span>";
    const title = document.getElementById("view-title");
    if (title) title.textContent = `Best parking for ${destination}.`;
    renderParkingList();
    if (state.map) state.map.flyTo([51.8985, -8.4756], 14, { duration: 0.6 });
    setTimeout(() => {
      button.innerHTML = previous;
      button.disabled = false;
    }, 950);
  }, 520);
}

function initNavigation() {
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => setFilter(chip.dataset.filter)));
  document.getElementById("search-button")?.addEventListener("click", runSearch);
  document.getElementById("destination")?.addEventListener("keydown", event => {
    if (event.key === "Enter") runSearch();
  });

  document.querySelectorAll(".mode").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode").forEach(mode => mode.classList.toggle("active", mode === button));
      setView(button.dataset.mode === "intelligence" ? "network" : "find");
    });
  });
}

renderParkingList();
initNavigation();
initMap();
