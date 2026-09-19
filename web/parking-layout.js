// WHITEBLOCK provider-independent parking layout.
// Visualises nearby parking relative to the searched destination using real
// coordinates. This is a schematic spatial layout, not an exact car-park footprint.

(() => {
  if (typeof state === "undefined") return;

  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  let layoutMode = false;
  let panel = null;
  let layoutButton = null;

  function escapeLayoutHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusColour(item) {
    if (item.available == null || item.capacity == null || item.capacity <= 0) return "#8FA39A";
    const ratio = item.available / item.capacity;
    if (ratio >= 0.25) return "#52D98D";
    if (ratio >= 0.12) return "#C8F56B";
    return "#F1C46B";
  }

  function nearbyResults() {
    if (typeof currentData !== "function") return [];
    try {
      return currentData().filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    } catch (error) {
      console.warn("WHITEBLOCK parking layout could not read current results", error);
      return [];
    }
  }

  function relativeKm(destination, item) {
    const meanLat = ((destination.lat + item.lat) / 2) * Math.PI / 180;
    return {
      x: (item.lng - destination.lng) * 111.32 * Math.cos(meanLat),
      y: (item.lat - destination.lat) * 110.57
    };
  }

  function resolveCollisions(points) {
    const placed = [];
    points.forEach((point, index) => {
      let { x, y } = point;
      let attempts = 0;
      while (placed.some(other => Math.hypot(x - other.x, y - other.y) < 12) && attempts < 10) {
        const angle = (index * 1.73 + attempts * 0.92) % (Math.PI * 2);
        const radius = 6 + attempts * 2.2;
        x = Math.max(10, Math.min(90, point.x + Math.cos(angle) * radius));
        y = Math.max(12, Math.min(88, point.y + Math.sin(angle) * radius));
        attempts += 1;
      }
      point.x = x;
      point.y = y;
      placed.push(point);
    });
    return points;
  }

  function projectedResults(destination, results) {
    const raw = results.map((item, index) => ({ item, index, ...relativeKm(destination, item) }));
    const maxRadius = Math.max(0.75, ...raw.map(point => Math.hypot(point.x, point.y)));
    const projected = raw.map(point => ({
      ...point,
      x: 50 + (point.x / maxRadius) * 37,
      y: 50 - (point.y / maxRadius) * 37
    }));
    return { maxRadius, points: resolveCollisions(projected) };
  }

  function ringLabel(maxRadius, fraction) {
    const km = maxRadius * fraction;
    return km < 1 ? `${Math.max(100, Math.round(km * 1000 / 100) * 100)} m` : `${km.toFixed(km >= 3 ? 0 : 1)} km`;
  }

  function createPanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "parking-layout-panel";
    panel.setAttribute("aria-label", "Relative parking layout around destination");
    mapEl.appendChild(panel);
    return panel;
  }

  function emptyLayout(title, copy) {
    createPanel().innerHTML = `
      <div class="parking-layout-grid"></div>
      <div class="parking-layout-head"><div><strong>${escapeLayoutHtml(title)}</strong><small>${escapeLayoutHtml(copy)}</small></div></div>
      <div class="parking-layout-destination"><span>⌖</span></div>
      <div class="parking-layout-foot"><span>Schematic spatial layout</span><span>No parking footprint is inferred</span></div>`;
  }

  function renderLayout() {
    if (!panel) createPanel();
    const destination = state.destination;
    if (!destination || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
      emptyLayout("Choose a destination", "Search for a place to generate its parking layout.");
      return;
    }

    const inPilot = typeof isInCorkPilot === "function" ? isInCorkPilot(destination.lat, destination.lng) : true;
    if (!inPilot) {
      emptyLayout("Destination located", "Parking inventory is not connected for this area yet.");
      return;
    }

    const results = nearbyResults();
    if (!results.length) {
      emptyLayout("No nearby parking in the current evidence layer", "The layout will populate when supported parking locations are found.");
      return;
    }

    const { maxRadius, points } = projectedResults(destination, results);
    const destinationLabel = destination.primary || destination.label || "Selected destination";
    const nodes = points.map(({ item, index, x, y }) => {
      const selected = item.id === state.selectedId ? " selected" : "";
      const available = item.available != null ? `${Math.round(item.available)} free` : "availability unknown";
      const walk = item.walk != null ? `~${item.walk} min walk` : (item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : "distance pending");
      return `
        <button class="parking-layout-node${selected}" type="button" data-parking-layout-id="${escapeLayoutHtml(item.id)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--node-color:${statusColour(item)}" aria-label="Select ${escapeLayoutHtml(item.name)}">
          <span class="parking-layout-node-core">${String(index + 1).padStart(2, "0")}</span>
          <span class="parking-layout-node-label"><strong>${escapeLayoutHtml(item.name)}</strong><small>${escapeLayoutHtml(available)} · ${escapeLayoutHtml(walk)}</small></span>
        </button>`;
    }).join("");

    panel.innerHTML = `
      <div class="parking-layout-grid"></div>
      <div class="parking-layout-ring r1"><span>${ringLabel(maxRadius, .33)}</span></div>
      <div class="parking-layout-ring r2"><span>${ringLabel(maxRadius, .66)}</span></div>
      <div class="parking-layout-ring r3"><span>${ringLabel(maxRadius, 1)}</span></div>
      <div class="parking-layout-head">
        <div><strong>Parking Layout · ${results.length} nearby</strong><small>${escapeLayoutHtml(destinationLabel)}</small></div>
      </div>
      <div class="parking-layout-destination"><span>⌖</span></div>
      ${nodes}
      <div class="parking-layout-foot"><span>Position = real relative coordinates</span><span>Colour = availability pressure</span><span>Footprints/bays shown only when verified geometry exists</span></div>`;

    panel.querySelectorAll("[data-parking-layout-id]").forEach(node => {
      node.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const id = node.dataset.parkingLayoutId;
        if (typeof selectParking === "function") selectParking(id);
        window.setTimeout(renderLayout, 30);
      });
    });
  }

  function setLayoutMode(enabled) {
    layoutMode = enabled;
    createPanel();
    panel.classList.toggle("active", enabled);
    mapEl.classList.toggle("layout-active", enabled);
    layoutButton?.classList.toggle("active", enabled);
    layoutButton?.setAttribute("aria-pressed", String(enabled));
    if (enabled) renderLayout();
    else if (state.map) window.setTimeout(() => state.map.invalidateSize({ pan: false, animate: false }), 20);
  }

  function installLayoutButton() {
    const toolbar = document.querySelector(".wb-map-toolbar");
    if (!toolbar || document.querySelector(".wb-parking-layout-button")) return false;
    layoutButton = document.createElement("button");
    layoutButton.type = "button";
    layoutButton.className = "wb-parking-layout-button wb-map-layer-button";
    layoutButton.textContent = "Parking Layout";
    layoutButton.setAttribute("aria-pressed", "false");
    layoutButton.title = "Show nearby parking as a destination-centred spatial layout";
    layoutButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setLayoutMode(!layoutMode);
    });
    toolbar.appendChild(layoutButton);

    toolbar.querySelectorAll(".wb-map-layer-button[data-layer]").forEach(button => {
      button.addEventListener("click", () => setLayoutMode(false));
    });
    return true;
  }

  function preferTerrainDefault() {
    const terrain = document.querySelector('.wb-map-layer-button[data-layer="terrain"]');
    if (!terrain) return;
    terrain.click();
    mapEl.dataset.preferredBasemap = "terrain";
  }

  createPanel();
  installLayoutButton();
  window.requestAnimationFrame(preferTerrainDefault);

  const parkingList = document.getElementById("parking-list");
  if (parkingList && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      if (layoutMode) renderLayout();
    }).observe(parkingList, { childList: true, subtree: true });
  }

  document.addEventListener("whiteblock:data-ready", () => {
    if (layoutMode) renderLayout();
  });

  document.addEventListener("click", event => {
    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions") || event.target.closest?.(".chip")) {
      window.setTimeout(() => {
        if (layoutMode) renderLayout();
      }, 650);
    }
  });
})();
