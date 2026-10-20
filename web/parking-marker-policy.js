// WHITEBLOCK universal marker policy: applies to all current and future regions.
// One source of truth for zoom thresholds, on-screen grouping and inventory dedup.
// Pure browser logic; never changes location coordinates or invents free spaces.
(() => {
  const MARKER_POLICY = Object.freeze({
    rankedRadiusPx: 56,
    inventoryRadiusPx: 56,
    localityRadiusPx: 132,
    detailZoom: 17,
    localityDetailZoom: 16,
    minimumFootprintZoom: 14
  });

  function browseActive(view) {
    return Boolean(view?.overviewMode === true || view?.regionFocus);
  }

  function canonicalRegion(key) {
    const region = String(key || "").trim().toLowerCase();
    if (region === "bray") return "wicklow";
    if (region === "corkcounty" || region === "corkcity") return "cork";
    return region;
  }

  // Screen-distance clustering for any number of mapped parking locations.
  // For large county inventories use a screen-space grid and union neighboring
  // grid cells, so complexity is close to O(n) rather than all-pairs O(n^2).
  // Return original row indices; callers always preserve real coordinates.
  function groupNearby(rows, zoom, project, options = {}) {
    const radiusPx = Math.max(8, Number(options.radiusPx) || MARKER_POLICY.rankedRadiusPx);
    const detailZoom = Number.isFinite(options.detailZoom) ? options.detailZoom : MARKER_POLICY.detailZoom;
    if (!Array.isArray(rows) || !rows.length) return [];
    if (zoom >= detailZoom) return rows.map((_, index) => [index]);

    const cells = new Map();
    rows.forEach((item, index) => {
      const lat = Number(item?.lat);
      const lng = Number(item?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const point = project(item, zoom);
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
      const x = Math.floor(point.x / radiusPx);
      const y = Math.floor(point.y / radiusPx);
      const id = x + ":" + y;
      let cell = cells.get(id);
      if (!cell) {
        cell = { x, y, indices: [], parent: id };
        cells.set(id, cell);
      }
      cell.indices.push(index);
    });
    function root(id) {
      let cell = cells.get(id);
      if (!cell) return null;
      while (cell.parent !== (cell.x + ":" + cell.y)) {
        const parent = cells.get(cell.parent);
        if (!parent) break;
        cell.parent = parent.parent;
        cell = parent;
      }
      return cell.x + ":" + cell.y;
    }
    // Each cell is one marker. Merge adjacent cells so icons at tile edges
    // do not overlap; transitive groups adapt naturally while zooming.
    cells.forEach(cell => {
      const own = cell.x + ":" + cell.y;
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (!dx && !dy) continue;
          const neighbor = cell.x + dx + ":" + (cell.y + dy);
          if (!cells.has(neighbor)) continue;
          const a = root(own), b = root(neighbor);
          if (a && b && a !== b) cells.get(b).parent = a;
        }
      }
    });
    const groups = new Map();
    cells.forEach((cell, id) => {
      const key = root(id) || id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(...cell.indices);
    });
    return [...groups.values()]
      .map(indices => indices.sort((a, b) => a - b))
      .sort((a, b) => a[0] - b[0]);
  }

  function connectedInventory(view, fallback = []) {
    const inventories = view?.regionInventories || {};
    const priority = key => {
      const region = canonicalRegion(key);
      if (region === key.toLowerCase()) return 0;
      return 1;
    };
    const pools = Object.entries(inventories)
      .filter(([, items]) => Array.isArray(items))
      .sort(([a], [b]) => priority(a) - priority(b) || a.localeCompare(b));
    const found = new Set();
    const rows = [];
    pools.forEach(([key, items]) => {
      items.forEach(item => {
        const id = String(item?.id || item?.parking_id || "");
        if (!id || found.has(id)) return;
        if (!Number.isFinite(Number(item?.lat)) || !Number.isFinite(Number(item?.lng))) return;
        found.add(id);
        rows.push({ ...item, region: item.region || canonicalRegion(key) });
      });
    });
    if (!rows.length && Array.isArray(fallback)) {
      fallback.forEach(item => {
        if (!item?.id || found.has(item.id)) return;
        if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
        found.add(item.id);
        rows.push({ ...item, region: item.region || view?.activeRegion || "unknown" });
      });
    }
    return rows;
  }

  window.WHITEBLOCK_MARKER_POLICY = Object.freeze({
    ...MARKER_POLICY,
    browseActive,
    canonicalRegion,
    groupNearby,
    connectedInventory
  });
})();
