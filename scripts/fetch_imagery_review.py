#!/usr/bin/env python3
"""Fetch temporary aerial/satellite review images for WHITEBLOCK targets.

Images are CI review artifacts only and are deliberately not committed to the
repository. Esri World Imagery is used for internal visual review with required
attribution; production should prefer appropriately licensed Tailte Éireann
orthophotography where credentials/licensing permit.

No automated computer-vision result is promoted to parking truth by this script.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from PIL import Image, ImageDraw

TILE_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
META_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/0/query"
ATTRIBUTION = "Sources: Esri and imagery contributors; internal review artifact only."
USER_AGENT = "WHITEBLOCK/1.0 imagery-review personal research prototype"
ZOOM = 18
TILE_SIZE = 256
GRID_RADIUS = 1


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request(url: str, timeout: int = 10) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def safe_name(value: Any) -> str:
    text = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "target"))
    return text[:110].strip("_") or "target"


def tile_position(lat: float, lng: float, zoom: int = ZOOM):
    n = 2 ** zoom
    x = (lng + 180.0) / 360.0 * n
    lat_rad = math.radians(max(-85.05112878, min(85.05112878, lat)))
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return x, y


def imagery_frame(lat: float, lng: float) -> Image.Image:
    x_float, y_float = tile_position(lat, lng)
    x_center, y_center = int(math.floor(x_float)), int(math.floor(y_float))
    grid = 2 * GRID_RADIUS + 1
    mosaic = Image.new("RGB", (grid * TILE_SIZE, grid * TILE_SIZE))

    for gy, ty in enumerate(range(y_center - GRID_RADIUS, y_center + GRID_RADIUS + 1)):
        for gx, tx in enumerate(range(x_center - GRID_RADIUS, x_center + GRID_RADIUS + 1)):
            url = TILE_URL.format(z=ZOOM, y=ty, x=tx)
            raw = request(url)
            tile = Image.open(io.BytesIO(raw)).convert("RGB")
            mosaic.paste(tile, (gx * TILE_SIZE, gy * TILE_SIZE))

    point_x = (GRID_RADIUS + (x_float - x_center)) * TILE_SIZE
    point_y = (GRID_RADIUS + (y_float - y_center)) * TILE_SIZE
    width, height = 640, 540
    left = int(round(point_x - width / 2))
    top = int(round(point_y - height / 2))
    left = max(0, min(mosaic.width - width, left))
    top = max(0, min(mosaic.height - height, top))
    frame = mosaic.crop((left, top, left + width, top + height))

    # The crosshair marks the source parking point; it is not a bay boundary.
    cx = int(round(point_x - left))
    cy = int(round(point_y - top))
    draw = ImageDraw.Draw(frame)
    draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), outline="white", width=3)
    draw.line((cx - 13, cy, cx + 13, cy), fill="white", width=2)
    draw.line((cx, cy - 13, cx, cy + 13), fill="white", width=2)
    return frame


def metadata_url(lat: float, lng: float) -> str:
    params = {
        "geometry": f"{lng},{lat}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "returnGeometry": "false",
        "f": "json",
    }
    return META_URL + "?" + urllib.parse.urlencode(params)


def fetch_metadata(lat: float, lng: float) -> Dict[str, Any] | None:
    try:
        payload = json.loads(request(metadata_url(lat, lng), timeout=5).decode("utf-8"))
        features = payload.get("features") or []
        return (features[0].get("attributes") or {}) if features else None
    except Exception:
        return None


def annotate(image: Image.Image, target: Dict[str, Any], metadata: Dict[str, Any] | None) -> Image.Image:
    strip_h = 92
    canvas = Image.new("RGB", (image.width, image.height + strip_h), "white")
    canvas.paste(image, (0, 0))
    draw = ImageDraw.Draw(canvas)
    name = str(target.get("name") or target.get("parking_id"))
    region = str(target.get("region") or "")
    line1 = f"{region} | {name}"[:100]
    line2 = f"{target.get('parking_id')} | {target.get('latitude'):.6f}, {target.get('longitude'):.6f} | z{ZOOM}"
    meta_copy = "Imagery metadata unavailable"
    if metadata:
        source = metadata.get("Source") or metadata.get("SRC_NAME") or metadata.get("NICE_NAME")
        date = metadata.get("AcquisitionDate") or metadata.get("SRC_DATE2") or metadata.get("SRC_DATE")
        resolution = metadata.get("Resolution") or metadata.get("SRC_RES") or metadata.get("RESOLUTION")
        meta_copy = f"Source: {source or 'see Esri attribution'} | date: {date or 'unknown'} | resolution: {resolution or 'unknown'}"
    draw.text((12, image.height + 8), line1, fill="black")
    draw.text((12, image.height + 30), line2[:125], fill="black")
    draw.text((12, image.height + 52), meta_copy[:125], fill="black")
    draw.text((12, image.height + 72), "Crosshair = mapped point. Review physical footprint only; access/live occupancy not inferred.", fill="black")
    return canvas


def contact_sheet(images: List[tuple[Dict[str, Any], Path]], output: Path, columns: int = 2):
    if not images:
        return
    thumbs = []
    for target, path in images:
        im = Image.open(path).convert("RGB")
        im.thumbnail((500, 494))
        tile = Image.new("RGB", (510, 504), "white")
        tile.paste(im, ((510 - im.width) // 2, 4))
        thumbs.append(tile)
    rows = math.ceil(len(thumbs) / columns)
    sheet = Image.new("RGB", (columns * 510, rows * 504), "white")
    for index, tile in enumerate(thumbs):
        sheet.paste(tile, ((index % columns) * 510, (index // columns) * 504))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=90)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--targets", type=Path, default=Path("imagery-review/targets.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("imagery-review/output"))
    args = parser.parse_args()

    payload = json.loads(args.targets.read_text(encoding="utf-8"))
    targets = payload.get("targets") or []
    args.output_dir.mkdir(parents=True, exist_ok=True)
    image_dir = args.output_dir / "images"
    image_dir.mkdir(exist_ok=True)

    manifest = {
        "schema_version": "1.1",
        "retrieved_at": now_z(),
        "imagery_provider": "Esri World Imagery",
        "imagery_zoom": ZOOM,
        "attribution": ATTRIBUTION,
        "licensing_note": "Review images are temporary CI artifacts and are not committed to the WHITEBLOCK repository.",
        "records": [],
    }
    per_region: Dict[str, List[tuple[Dict[str, Any], Path]]] = {}

    for index, target in enumerate(targets, start=1):
        lat = float(target["latitude"])
        lng = float(target["longitude"])
        filename = f"{index:03d}_{safe_name(target.get('region'))}_{safe_name(target.get('parking_id'))}.jpg"
        path = image_dir / filename
        record = dict(target)
        record.update({
            "review_status": "imagery_fetch_failed",
            "imagery_file": None,
            "imagery_metadata": None,
            "imagery_service": "Esri World Imagery tile service",
        })
        try:
            image = imagery_frame(lat, lng)
            metadata = fetch_metadata(lat, lng)
            annotate(image, target, metadata).save(path, quality=92)
            record["review_status"] = "imagery_ready_for_human_review"
            record["imagery_file"] = str(path.relative_to(args.output_dir))
            record["imagery_metadata"] = metadata
            per_region.setdefault(str(target.get("region")), []).append((target, path))
        except Exception as exc:
            record["error"] = str(exc)
        manifest["records"].append(record)
        print(f"[{index}/{len(targets)}] {target.get('region')} {target.get('parking_id')}: {record['review_status']}")

    for region, rows in per_region.items():
        contact_sheet(rows, args.output_dir / f"contact_sheet_{safe_name(region)}.jpg")

    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("ready", sum(r["review_status"] == "imagery_ready_for_human_review" for r in manifest["records"]), "of", len(manifest["records"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
