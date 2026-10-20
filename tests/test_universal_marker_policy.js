"use strict";
// Same marker rules apply to existing counties, nested pilots and future counties.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const policySource = fs.readFileSync(path.join(root, "web/parking-marker-policy.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(policySource, context, { filename: "parking-marker-policy.js" });
const policy = context.window.WHITEBLOCK_MARKER_POLICY;
assert.ok(policy);
assert.equal(policy.browseActive({ overviewMode: true }), true);
assert.equal(policy.browseActive({ regionFocus: "galway" }), true);
assert.equal(policy.browseActive({ destination: { lat: 52.5 } }), false);

const origins = {
  cork: [51.90, -8.48],
  kildare: [53.20, -6.78],
  dublin: [53.35, -6.26],
  wicklow: [52.98, -6.04],
  galway: [53.27, -9.05],
  donegal: [54.65, -8.11]
};
const fixtures = Object.fromEntries(Object.entries(origins).map(([region, [lat, lng]]) => [
  region, Array.from({ length: 7 }, (_, index) => ({
    id: region + "-" + index,
    lat: lat + index * 0.0005,
    lng: lng + index * 0.0005,
    available: null,
    capacity: null
  }))
]));
const project = (item, zoom) => ({
  x: item.lng * 256 * 2 ** zoom / 360,
  y: item.lat * 256 * 2 ** zoom / 360
});
for (const [region, rows] of Object.entries(fixtures)) {
  const far = policy.groupNearby(rows, 7, project);
  assert.equal(far.length, 1, region + " should show one parking marker at low zoom");
  assert.equal(far[0].length, 7, region + " should count seven mapped places");
  const near = policy.groupNearby(rows, 17, project);
  assert.equal(near.length, 7, region + " should spread into seven markers at detailed zoom");
  assert.ok(near.every(group => group.length === 1));
}
const inventories = {
  cork: fixtures.cork,
  corkCounty: [fixtures.cork[0], { id: "cork-extra", lat: 51.95, lng: -8.46 }],
  kildare: fixtures.kildare,
  dublin: fixtures.dublin,
  wicklow: fixtures.wicklow,
  bray: [{ id: "bray-pilot", lat: 53.2048, lng: -6.0996, region: "Wicklow" }],
  galway: fixtures.galway
};
const inventory = policy.connectedInventory({ regionInventories: inventories }, []);
assert.equal(inventory.length, 7 * 5 + 2, "canonical Cork + county supplemental + Bray pilot + future region");
assert.equal(inventory.filter(item => item.id === "cork-0").length, 1, "canonical and supplemental Cork overlap counted once");
assert.equal(inventory.find(item => item.id === "bray-pilot").region, "Wicklow");
assert.equal(inventory.filter(item => item.id.startsWith("galway-")).length, 7, "new Galway network added automatically");
assert.equal(policy.canonicalRegion("bray"), "wicklow");
assert.equal(policy.canonicalRegion("corkCounty"), "cork");
assert.equal(policy.canonicalRegion("Donegal"), "donegal");

const index = fs.readFileSync(path.join(root, "web/index.html"), "utf8");
const runtime = fs.readFileSync(path.join(root, "web/runtime-config.js"), "utf8");
const inventoryJs = fs.readFileSync(path.join(root, "web/inventory-map-layer.js"), "utf8");
const ranked = fs.readFileSync(path.join(root, "web/parking-gl-overlay.js"), "utf8");
const legacyMap = fs.readFileSync(path.join(root, "web/map-engine-v2.js"), "utf8");
const olderMapFix = fs.readFileSync(path.join(root, "web/map-fix.js"), "utf8");
const overview = fs.readFileSync(path.join(root, "web/ireland-overview.js"), "utf8");
const app = fs.readFileSync(path.join(root, "web/app.js"), "utf8");
assert.ok(index.indexOf("parking-marker-policy.js") < index.indexOf("runtime-config.js"), "policy initializes before map adapters");
assert.ok(runtime.includes("inventory-map-layer.js?v=20261020-3"));
assert.ok(runtime.includes("parking-gl-overlay.js?v=20261020-4"));
assert.ok(runtime.includes("ireland-overview.js?v=20261020-7"));
assert.ok(inventoryJs.includes("POLICY.connectedInventory(state, parkingData)"));
assert.ok(inventoryJs.includes("POLICY.groupNearby(items"), "inventory fallback still clusters when Leaflet plugin unavailable");
assert.ok(inventoryJs.includes('state.map?.on?.("zoomend"'), "fallback must re-cluster with zoom");
assert.ok(ranked.includes("POLICY.groupNearby(rows"));
assert.ok(ranked.includes('caption: "OPTIONS"'), "ranked clusters must identify quantity as OPTIONS");
assert.ok(ranked.includes("display_rank: displayRank"), "individual ranked markers must have explicit # rank labels");
assert.ok(ranked.includes("availability_label: freeLabel"), "availability must be a separate marker label");
assert.ok(ranked.includes("POINT_CLUSTER_CAPTION"), "cluster quantity needs a separate semantic caption layer");
assert.ok(ranked.includes("POINT_AVAILABILITY"), "individual availability needs a separate map label layer");
assert.ok(ranked.includes("POLICY.browseActive(state)"), "ranked overlay must not show inside Ireland or any county browse");
assert.ok(legacyMap.includes("window.__WHITEBLOCK_PARKING_GL_OVERLAY__"), "fallback Leaflet source must yield to the ranked MapLibre layer");
assert.ok(legacyMap.includes("policy.groupNearby(rows"), "fallback Leaflet ranked points must still cluster");
assert.ok(legacyMap.includes('document.addEventListener("whiteblock:ranked-gl-overlay-ready", renderParkingAreas)'), "old fallback clears after GL readiness");
assert.ok(ranked.includes("whiteblock:ranked-gl-overlay-ready"), "native overlay must announce renderer ownership");
assert.ok(olderMapFix.includes("window.WHITEBLOCK_MARKER_POLICY?.browseActive(state)"), "older map context haloes must not leak into national/county browse");
assert.ok(olderMapFix.includes('document.addEventListener("whiteblock:coverage-browse"'), "browse event must clear old map context haloes");
assert.ok(index.includes("map-fix.js?v=20261020-hybrid1"), "mobile clients should load the new map context cleanup");


assert.ok(overview.includes("MARKER_POLICY.groupNearby(rows"), "county locality and parking drill-down must cluster");
assert.ok(overview.includes("LOCATIONS"), "browse clusters must say LOCATIONS rather than show an unexplained number");
assert.ok(inventoryJs.includes("<small>locations</small>"), "inventory clusters must label their number as locations");
assert.ok(legacyMap.includes("<small>options</small>"), "destination-result fallback clusters must label their number as options");
assert.ok(legacyMap.includes("rankedOptionIcon"), "fallback individual options must show ordinal ranks");
assert.ok(app.includes('<span class="rank">#${index + 1}</span>'), "result cards must use the same explicit # ordinal rank");
assert.ok(overview.includes("registerNewRegionalInventories()"), "future source-backed counties join the national map automatically");
assert.ok(overview.includes("state.regionSubareaGroup"), "zoomend preserves locality drill-down selection");
assert.ok(!overview.includes("group.items.slice(0, 300)"), "locality visual aggregation must not silently drop assets");
console.log("All connected and future region map clustering rules verified");
