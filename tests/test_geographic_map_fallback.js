"use strict";
// Simulate an Android device with failed MapLibre/WebGL. WHITEBLOCK must keep
// the default aerial+labels Hybrid map geographically usable and must NEVER
// auto-open Parking Layout. Street remains the final independent fallback.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../web/map-engine-v2.js"), "utf8");
function fakeClassList() {
  const value = new Set();
  return {
    add(...keys) { keys.forEach(x => value.add(x)); },
    remove(...keys) { keys.forEach(x => value.delete(x)); },
    contains(key) { return value.has(key); }
  };
}

function scenario(kind) {
  const mapLayers = new Set();
  const mapEvents = new Map();
  const documentEvents = new Map();
  const timeouts = [];
  const mapEl = { classList: fakeClassList(), dataset: {} };
  const status = [];
  const sources = [];
  let layoutClicks = 0;
  let lastTile = null;

  const map = {
    eachLayer(fn) { [...mapLayers].forEach(fn); },
    on(name, fn) { mapEvents.set(name, fn); },
    hasLayer(layer) { return mapLayers.has(layer); },
    removeLayer(layer) { mapLayers.delete(layer); },
    getPane() { return null; },
    createPane() { return { style: {} }; },
    invalidateSize() {}
  };
  class TileLayer {
    constructor(url) { this.url = url; this.events = new Map(); }
    on(name, fn) { this.events.set(name, fn); return this; }
    addTo(target) {
      target.__addLayer(this);
      lastTile = this;
      return this;
    }
  }
  map.__addLayer = layer => {
    mapLayers.add(layer);
    mapEvents.get("layeradd")?.({ layer });
  };
  const gl = {
    isStyleLoaded: () => false,
    on() {},
    once() {},
    resize() {}
  };
  const L = {
    TileLayer,
    maplibreGL() {
      if (kind === "throw") throw new Error("WebGL unavailable");
      return {
        _glMap: gl,
        getMaplibreMap() { return gl; },
        addTo(target) { target.__addLayer(this); return this; }
      };
    },
    tileLayer(url) {
      sources.push(url);
      return new TileLayer(url);
    },
    latLng(lat, lng) { return { lat, lng }; },
    layerGroup() {
      return {
        addTo(target) { target.__addLayer(this); return this; },
        clearLayers() {}
      };
    }
  };
  const document = {
    getElementById(key) { return key === "map" ? mapEl : null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement() { return { dataset: {}, classList: fakeClassList() }; },
    head: { appendChild() {} },
    addEventListener(name, fn) { documentEvents.set(name, fn); },
    dispatchEvent() {}
  };
  const window = {
    WHITEBLOCK_MARKER_POLICY: { browseActive: () => false },
    setTimeout(fn, ms) { timeouts.push({ fn, ms }); return timeouts.length; },
    clearTimeout() {},
    requestAnimationFrame(fn) { fn(); },
    addEventListener() {}
  };
  const context = {
    state: { map, destination: null, selectedId: null },
    L, document, window, setMapStatus(...args) { status.push(args); },
    console, URLSearchParams, CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } }
  };
  vm.runInNewContext(script, context, { filename: "map-engine-v2.js" });
  const flushLayerRemoval = () => {
    // Execute just the asynchronous removal callbacks, not the style timer.
    const removals = timeouts.filter(task => task.ms === 0);
    removals.forEach(task => task.fn());
  };
  return { mapEl, map, document, status, sources, timeouts, flushLayerRemoval,
    get tile() { return lastTile; },
    get layoutClicks() { return layoutClicks; },
    rasterPresent() { return [...mapLayers].some(x => x instanceof TileLayer); } };
}

const error = scenario("throw");
assert.equal(error.rasterPresent(), true, "MapLibre exception must immediately leave a geographical map");
assert.ok(error.sources.some(url => url.includes("World_Imagery")), "Default fallback must keep aerial imagery");
assert.ok(error.sources.some(url => url.includes("World_Hybrid_Overlay")), "Default fallback must keep road/place labels");
assert.equal(error.mapEl.dataset.basemapEngine, "raster-fallback");
assert.equal(error.mapEl.dataset.basemap, "hybrid");
assert.equal(error.mapEl.classList.contains("layout-active"), false, "Layout must not activate automatically");

const hybridWatchdog = error.timeouts.find(task => task.ms === 3200);
assert.ok(hybridWatchdog, "Hybrid raster fallback must have an incomplete-grid watchdog");
hybridWatchdog.fn();
assert.ok(error.sources.some(url => url.includes("tile.openstreetmap.org")), "Stalled Hybrid imagery must fail over to an independent Street map");
assert.ok(!error.document.querySelector(".wb-parking-layout-button"));

for (let i = 0; i < 2; i++) error.tile.events.get("tileerror")?.();
assert.ok(error.sources.some(url => url.includes("cartocdn.com")), "Repeated Street tile failures retry with alternate road tiles");
error.flushLayerRemoval();
assert.equal(error.rasterPresent(), true, "Legacy layer cleanup must not delete fallback tiles");
assert.ok(error.status.some(([title]) => title.includes("Hybrid map")), "Visible status should identify the Hybrid compatibility fallback");
assert.equal(error.mapEl.dataset.basemapEngine, "raster-fallback");

const stalled = scenario("stalled");
assert.equal(stalled.rasterPresent(), false, "Healthy-looking GL renderer may initially await style health timeout");
const health = stalled.timeouts.find(task => task.ms === 4500);
assert.ok(health, "Vector style must have a bounded watchdog");
health.fn();
assert.equal(stalled.rasterPresent(), true, "A stalled Hybrid renderer must recover to actual geographical tiles");
assert.ok(stalled.sources.some(url => url.includes("World_Imagery")));
assert.ok(stalled.sources.some(url => url.includes("World_Hybrid_Overlay")));
assert.equal(stalled.mapEl.classList.contains("layout-active"), false);
console.log("Hybrid default, stalled renderer recovery, Street backup and no forced schematic: PASS");
