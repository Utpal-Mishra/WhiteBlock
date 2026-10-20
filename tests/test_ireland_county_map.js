"use strict";
// Browser-free regression of national overview, county auto-fit, marker counts,
// zoom-to-real-sites, and delayed county data (including Bray pilot).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const markerSource = fs.readFileSync(path.join(root, "web/parking-marker-policy.js"), "utf8");
const overviewSource = fs.readFileSync(path.join(root, "web/ireland-overview.js"), "utf8");
const rendered = [];
const fits = [];
const handlers = new Map();
let zoom = 7;

function mkItems(prefix, n, origin) {
  return Array.from({ length: n }, (_, i) => ({
    id: prefix + "-" + i, name: prefix + " Parking " + (i + 1),
    lat: origin[0] + (i * .002), lng: origin[1] + (i * .002),
    available: null, capacity: null, area: prefix
  }));
}
const cork = mkItems("Cork", 7, [51.9,-8.48]);
const dublin = mkItems("Dublin", 10, [53.35,-6.26]);
const kildare = mkItems("Kildare", 4, [53.2,-6.78]);
const wicklow = mkItems("Wicklow", 5, [52.94,-6.34]);
const bray = mkItems("Bray", 1, [53.2048,-6.0996]);
const state = {
  map: null, markers: new Map(), destination: null, selectedId: null,
  regionInventories: {cork, dublin, kildare, wicklow, bray},
  regionSnapshots: {
    corkCounty: {locations: cork}, dublin: {locations: dublin},
    kildare: {locations: kildare}, wicklow: {locations: wicklow}
  }
};
function layerGroup() {
  const layer = {markers:[], addTo(map) { map.addLayer(this); return this; }};
  return layer;
}
function marker(type, coords, opts = {}) {
  const obj = {
    type, coords, html: opts.icon?.html || "", events: new Map(),
    addTo(layer) { layer.markers.push(this); rendered.push(this); return this; },
    bindTooltip() { return this; },
    on(name, cb) { this.events.set(name, cb); return this; }
  };
  return obj;
}
const map = {
  layers: new Set(), events: new Map(), pane: {style:{}},
  addLayer(layer) { this.layers.add(layer); return this; },
  removeLayer(layer) { this.layers.delete(layer); return this; },
  getPane() { return this.pane; },
  createPane() { return this.pane; },
  getZoom() { return zoom; },
  project(pt,z) { return {x:pt.lng * 256 * 2 ** z / 360, y:pt.lat * 256 * 2 ** z / 360}; },
  getBounds() { return {pad() {return {contains() {return true;}};}}; },
  fitBounds(bounds, opts) { fits.push({bounds,opts}); zoom = opts?.maxZoom ?? 7; },
  flyToBounds(bounds, opts) { fits.push({bounds, opts}); zoom=7; },
  flyTo(point,z) { fits.push({point,z}); zoom=z; },
  setView(point,z) { this.flyTo(point,z); },
  on(name,cb) { this.events.set(name, cb); }
};
state.map = map;
const nodes = Object.fromEntries(["map-title","parking-list","destination","view-title"].map(k=>[k,{textContent:"",innerHTML:"",value:"",placeholder:""}]));
const document = {
  getElementById(id) {return nodes[id] || null;},
  querySelector(selector) {return selector === ".result-count" ? {textContent:""} : null;},
  querySelectorAll() {return [];},
  addEventListener(name,cb) {handlers.set(name,cb);},
  dispatchEvent(event) {handlers.get(event.type)?.(event);}
};
const windowObj = {
  setInterval() {return 1;}, clearInterval() {},
  setTimeout(cb) {cb(); return 1;}
};
const L = {
  divIcon(conf) {return conf;},
  marker(coords,opts) {return marker("marker",coords,opts);},
  circleMarker(coords,opts) {return marker("circle",coords,opts);},
  layerGroup, latLng(lat,lng) {return {lat,lng};},
  latLngBounds(points) {return {points};}
};
const ctx = {
  state, L, document, window:windowObj, parkingData:cork,
  escapeHtml: v => String(v), console,
  CustomEvent: class {constructor(type,options) {this.type=type;this.detail=options?.detail;}}
};
vm.runInNewContext(markerSource, ctx);
vm.runInNewContext(overviewSource,ctx);

function activeMarkers() {
  const layer=state.irelandOverviewLayer;
  return layer?.markers || [];
}
let overview = windowObj.WHITEBLOCK_IRELAND_OVERVIEW;
assert.ok(overview);
assert.equal(state.overviewMode,true);
assert.equal(activeMarkers().length,4,"Ireland map must show exactly four county count markers");
const nationalHtml=activeMarkers().map(m=>m.html).join("\n");
for(const [county,count] of [["Cork",7],["Kildare",4],["Dublin",10],["Wicklow",6]]) {
  assert.ok(nationalHtml.includes("County "+county),county+" county label present");
  assert.ok(nationalHtml.includes(count+" mapped locations"),county+" total mapped count present");
}
assert.ok(nationalHtml.includes("Vacancies unverified"),"Don't claim live free spaces without feed");
assert.equal(fits.at(-1).bounds.length,2,"Ireland opens fitted to island coordinates");

overview.focusRegion("cork");
assert.equal(state.regionFocus,"cork");
assert.equal(state.destination,null,"County browse must not invent a destination");
assert.equal(fits.at(-1).bounds.points.length,7,"County auto-fits to all 7 real site coordinates");
assert.ok(activeMarkers().length>=1,"County map must show clustered parking immediately");
const markerLabels=activeMarkers().map(m=>m.html).join(" ");
assert.ok(markerLabels.includes("parking locations") || activeMarkers().some(m=>m.type==="circle"));
zoom=17;
map.events.get("zoomend")();
assert.equal(activeMarkers().filter(x=>x.type==="circle").length,7,"Detailed county zoom shows all individual sites");
overview.focusRegion("dublin");
assert.equal(fits.at(-1).bounds.points.length,10,"Same auto-fit used for another county");
zoom=17;map.events.get("zoomend")();
assert.equal(activeMarkers().filter(x=>x.type==="circle").length,10);

overview.show({animate:false});
assert.equal(state.regionFocus,null);
assert.equal(activeMarkers().length,4);
assert.equal(fits.at(-1).bounds.length,2,"Return to Ireland must restore island-wide camera");
const before=fits.length;
document.dispatchEvent(new ctx.CustomEvent("whiteblock:region-inventory-ready",{detail:{region:"cork"}}));
assert.equal(fits.length,before,"Asynchronous data refresh must not repeatedly reset Ireland camera");

state.regionInventories.wicklow = [];
delete state.regionSnapshots.wicklow;
overview.focusRegion("wicklow");
assert.equal(state.regionPendingFit,"wicklow","Bray-only pilot does not terminate pending full-county fit");
state.regionInventories.wicklow = wicklow;
state.regionSnapshots.wicklow = {locations:wicklow};
document.dispatchEvent(new ctx.CustomEvent("whiteblock:region-inventory-ready",{detail:{region:"wicklow"}}));
assert.equal(fits.at(-1).bounds.points.length,6,"Late Wicklow snapshot fits all sites including Bray");
assert.equal(state.regionPendingFit,null,"Full county source ends pending fit");
assert.equal(overview.stats().perRegion.wicklow.locations,6,"Bray counted once within Wicklow");
assert.equal(overview.stats().perRegion.cork.available,null,"Missing live occupancy not invented");

console.log("Ireland county totals, all-site county zoom, Bray/delayed data, live-data safety: PASS");
