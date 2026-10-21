// Regression: recommended parking markers must cluster with zoom and never
// leak into national or county browse maps, even with the older Cork data loaded.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../web/parking-gl-overlay.js"), "utf8");
const policySource = fs.readFileSync(path.join(__dirname, "../web/parking-marker-policy.js"), "utf8");
const documentHandlers = new Map();
const mapHandlers = new Map();
const glHandlers = new Map();
const mapLayers = new Set();
let sourceData = null;
let lastFly = null;
let zoom = 7;

const cork = { lat: 51.8985, lng: -8.4756 };
const parkingData = Array.from({ length: 7 }, (_, index) => ({
  id: "cork-" + index,
  name: "Cork parking " + (index + 1),
  lat: cork.lat + index * 0.001,
  lng: cork.lng + index * 0.001,
  capacity: null,
  available: null
}));
const state = {
  map: null,
  selectedId: null,
  overviewMode: true,
  regionFocus: null,
  destination: null
};
const glSource = { setData(value) { sourceData = value; } };
const glMap = {
  isStyleLoaded: () => true,
  getSource: id => id === "whiteblock-ranked-parking" && sourceData ? glSource : null,
  addSource(id, config) { assert.equal(id, "whiteblock-ranked-parking"); sourceData = config.data; },
  getLayer: id => mapLayers.has(id) ? {} : null,
  addLayer(config) { mapLayers.add(config.id); },
  on(event, layerOrHandler, handler) {
    glHandlers.set(event + (typeof layerOrHandler === "string" ? ":" + layerOrHandler : ""), handler || layerOrHandler);
  }
};
const leafMap = {
  eachLayer(callback) { callback({ _glMap: glMap }); },
  getZoom() { return zoom; },
  project(point, requestedZoom) {
    const scale = 256 * 2 ** requestedZoom / 360;
    return { x: point.lng * scale, y: point.lat * scale };
  },
  unproject(point, requestedZoom) {
    const scale = 256 * 2 ** requestedZoom / 360;
    return { lng: Number(point[0]) / scale, lat: Number(point[1]) / scale };
  },
  on(event, listener) { mapHandlers.set(event, listener); },
  flyTo(point, requestedZoom) { lastFly = { point, zoom: requestedZoom }; zoom = requestedZoom; }
};
state.map = leafMap;
const L = { latLng: (lat, lng) => ({ lat, lng }) };
const context = {
  L,
  state,
  parkingData,
  window: { setTimeout(callback) { callback(); } },
  document: { addEventListener(event, listener) { documentHandlers.set(event, listener); } },
  currentData: () => parkingData,
  haversineKm: () => 0,
  URLSearchParams,
  fetch: async () => ({ ok: true, json: async () => ({ elements: [] }) }),
  console
};

vm.runInNewContext(policySource, context, { filename: "parking-marker-policy.js" });
vm.runInNewContext(source, context, { filename: "parking-gl-overlay.js" });
assert.ok(sourceData, "MapLibre overlay should attach its source");
assert.equal(sourceData.features.length, 0, "National view must not show old ranked Cork markers");

state.overviewMode = false;
state.destination = { ...cork };
mapHandlers.get("zoomend")();
const lowFeatures = sourceData.features;
assert.equal(lowFeatures.length, 1, "Seven nearby parking locations must collapse into one marker at low zoom");
assert.equal(lowFeatures[0].properties.kind, "cluster");
assert.equal(lowFeatures[0].properties.count, 7);
assert.equal(lowFeatures[0].properties.rank, "7");
assert.equal(glMap.getLayer("whiteblock-ranked-parking-point") != null, true);

const clusterClick = glHandlers.get("click:whiteblock-ranked-parking-point");
assert.equal(typeof clusterClick, "function", "Cluster must support tap-to-zoom");
clusterClick({ features: [{ properties: { kind: "cluster" }, geometry: { coordinates: [-8.47, 51.90] } }] });
assert.equal(lastFly.zoom, 9, "Cluster tap zooms in instead of selecting an invented location");

zoom = 17;
mapHandlers.get("zoomend")();
const detailed = sourceData.features;
assert.equal(detailed.filter(feature => feature.properties.kind === "cluster").length, 0);
assert.equal(detailed.filter(feature => feature.properties.kind === "point").length, 7);
assert.equal(detailed.filter(feature => feature.properties.kind === "polygon").length, 7);
assert.deepEqual(
  detailed.filter(feature => feature.properties.kind === "point").map(feature => feature.properties.rank).join(","),
  "01,02,03,04,05,06,07",
  "Detailed markers retain their original recommendation rank"
);
assert.ok(
  detailed.filter(feature => feature.properties.kind === "point").every(feature => feature.properties.availability_label === ""),
  "Null live availability must not become a misleading 0 FREE label"
);

// Very close/duplicate source locations must remain individually legible at
// detailed zoom rather than stack their circles and labels on top of each other.
parkingData[0].lat = cork.lat;
parkingData[0].lng = cork.lng;
parkingData[1].lat = cork.lat + 0.00001;
parkingData[1].lng = cork.lng + 0.00001;
parkingData[2].lat = cork.lat + 0.00002;
parkingData[2].lng = cork.lng + 0.00002;
mapHandlers.get("zoomend")();
const crowded = sourceData.features;
assert.ok(crowded.some(feature => feature.properties.kind === "spider-line"), "Crowded detail markers should fan out with connector lines");
assert.equal(crowded.filter(feature => feature.properties.kind === "point").length, 7, "Spider layout must preserve every ranked option");
assert.equal(crowded.filter(feature => feature.properties.kind === "cluster").length, 0, "Detailed spider layout replaces the unreadable cluster");

state.overviewMode = true;
state.destination = null;
documentHandlers.get("whiteblock:coverage-browse")();
assert.equal(sourceData.features.length, 0, "Returning to Ireland must clear old markers and footprints");

state.overviewMode = false;
state.regionFocus = "cork";
state.destination = { ...cork };
mapHandlers.get("zoomend")();
assert.equal(sourceData.features.length, 0, "County browsing must show locality aggregates, not destination ranks");
console.log("Ranked GL clustering and overview isolation tests passed");
