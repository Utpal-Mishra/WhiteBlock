// WHITEBLOCK prototype basemap adapter.
// Replaces the previous key-gated CARTO tiles with OpenStreetMap standard raster tiles.
// No client-side API key is required. Production should use a managed/self-hosted tile service
// with an explicit SLA, quota and caching policy.

(() => {
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;

  // Remove only raster tile layers; keep WHITEBLOCK markers, coverage layers and controls intact.
  state.map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) state.map.removeLayer(layer);
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  // Preserve WHITEBLOCK's dark visual language without depending on a paid dark-map API.
  const tilePane = state.map.getPane("tilePane");
  if (tilePane) {
    tilePane.style.filter = "grayscale(1) invert(1) brightness(.68) contrast(1.18) hue-rotate(170deg) saturate(.45)";
  }
})();
