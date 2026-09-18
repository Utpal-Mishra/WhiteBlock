// WHITEBLOCK Parking Guidance Intelligence map layer.
// Loads the official Dublin City Council VMS location registry. The registry contains
// sign locations only; it does NOT expose the live value/text currently displayed.

(() => {
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;

  const map = state.map;

  if (!document.querySelector('script[data-wb-tile-resilience]')) {
    const resilienceScript = document.createElement("script");
    resilienceScript.src = "./tile-resilience.js?v=20260918-1";
    resilienceScript.dataset.wbTileResilience = "true";
    document.body.appendChild(resilienceScript);
  }

  const SOURCE_URL = "https://data.smartdublin.ie/dataset/79851619-f51d-4799-99b3-6e5d20d26aa3/resource/ad0ca283-8780-42b3-959e-f92a13d564a9/download/dcc_variable_message_signs_4326.geojson";
  const DATASET_URL = "https://data.gov.ie/dataset/dublin-city-council-variable-message-signs";
  const sourceLabel = "Dublin City Council VMS registry";

  let guidanceLayer = L.layerGroup().addTo(map);
  let enabled = true;
  let loadState = "loading";
  let featureCount = 0;

  function propertiesOf(feature) {
    const input = feature?.properties || {};
    const normalised = {};
    Object.entries(input).forEach(([key, value]) => {
      normalised[String(key).trim().toLowerCase().replaceAll(" ", "_")] = value;
    });
    return normalised;
  }

  function first(properties, ...keys) {
    for (const key of keys) {
      const value = properties[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return null;
  }

  function signIcon() {
    return L.divIcon({
      className: "wb-guidance-marker-wrapper",
      html: '<div class="wb-guidance-marker"><span>P</span><i></i><i></i></div>',
      iconSize: [34, 30],
      iconAnchor: [17, 26]
    });
  }

  function popupContent(feature, index) {
    const p = propertiesOf(feature);
    const externalId = first(p, "equipment_id", "equipmentid", "equip_id", "equipid", "vms_id", "objectid", "id") || index;
    const name = first(p, "location_name", "locationname", "location", "name", "road_name", "road") || `Dublin VMS ${externalId}`;

    return `
      <div class="wb-guidance-popup">
        <span class="wb-guidance-kicker">Parking guidance display</span>
        <strong>${escapeGuidanceHtml(name)}</strong>
        <small>Equipment ${escapeGuidanceHtml(externalId)}</small>
        <div class="wb-guidance-source-state">
          <span class="wb-guidance-state-dot"></span>
          <span>Official location · live display value not exposed by this source</span>
        </div>
        <p>WHITEBLOCK keeps this sign as a guidance asset. A future operator feed, permitted camera/OCR observation or direct display feed can attach time-stamped readings without overwriting the parking system feed.</p>
        <a href="${DATASET_URL}" target="_blank" rel="noopener noreferrer">View official source ↗</a>
      </div>`;
  }

  function escapeGuidanceHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function validPoint(feature) {
    const geometry = feature?.geometry;
    return geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2;
  }

  function renderFeatures(payload) {
    guidanceLayer.clearLayers();
    const features = Array.isArray(payload?.features) ? payload.features.filter(validPoint) : [];
    featureCount = features.length;

    features.forEach((feature, index) => {
      const [lng, lat] = feature.geometry.coordinates.map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.marker([lat, lng], { icon: signIcon(), pane: "markerPane" }).addTo(guidanceLayer);
      marker.bindPopup(popupContent(feature, index + 1), { maxWidth: 285, className: "wb-guidance-popup-shell" });
    });

    loadState = featureCount ? "ready" : "empty";
    updateControl();
  }

  async function loadGuidanceRegistry() {
    loadState = "loading";
    updateControl();
    try {
      const response = await fetch(SOURCE_URL, { headers: { Accept: "application/geo+json,application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      renderFeatures(await response.json());
    } catch (error) {
      console.warn("WHITEBLOCK VMS registry unavailable", error);
      loadState = "unavailable";
      guidanceLayer.clearLayers();
      updateControl();
    }
  }

  function toggleLayer() {
    enabled = !enabled;
    if (enabled) guidanceLayer.addTo(map);
    else map.removeLayer(guidanceLayer);
    updateControl();
  }

  function controlLabel() {
    if (loadState === "loading") return "Guidance · loading";
    if (loadState === "unavailable") return "Guidance · source unavailable";
    if (loadState === "empty") return "Guidance · no signs";
    return `Guidance · ${featureCount}`;
  }

  function updateControl() {
    const button = document.getElementById("wb-guidance-toggle");
    if (!button) return;
    button.textContent = controlLabel();
    button.classList.toggle("active", enabled && loadState === "ready");
    button.classList.toggle("source-error", loadState === "unavailable");
    button.setAttribute("aria-pressed", String(enabled));
    button.title = loadState === "ready"
      ? `${sourceLabel}: ${featureCount} official display locations. Live sign text is not supplied by this dataset.`
      : `${sourceLabel}: ${loadState}`;
  }

  function createControl() {
    const toolbar = document.querySelector(".wb-map-toolbar");
    if (!toolbar || document.getElementById("wb-guidance-toggle")) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "wb-guidance-toggle";
    button.className = "wb-guidance-toggle";
    button.setAttribute("aria-pressed", "true");
    button.textContent = "Guidance · loading";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleLayer();
    });
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.disableScrollPropagation(button);
    toolbar.appendChild(button);
    return true;
  }

  function installControl() {
    if (createControl()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (createControl() || attempts > 30) window.clearInterval(timer);
    }, 100);
  }

  installControl();
  loadGuidanceRegistry();
})();
