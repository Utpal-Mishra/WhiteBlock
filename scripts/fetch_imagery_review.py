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

from PIL import Image, ImageDraw, ImageFont

EXPORT_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
META_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/0/query"
ATTRIBUTION = "Sources: Esri and imagery contributors; internal review artifact only."
USER_AGENT = "WHITEBLOCK/1.0 imagery-review personal research prototype"


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request(url: str, timeout: int = 35) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def safe_name(value: Any) -> str:
    text = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "target"))
    return text[:110].strip("_") or "target"


def bbox(lat: float, lng: float, half_height_m: float = 150, half_width_m: float = 190):
    dlat = half_height_m / 111320.0
    dlng = half_width_m / (111320.0 * max(0.25, math.cos(math.radians(lat))))
    return lng - dlng, lat - dlat, lng + dlng, lat + dlat


def imagery_url(lat: float, lng: float) -> str:
    west, south, east, north = bbox(lat, lng)
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326",
        "size": "720,600",
        "imageSR": "3857",
        "format": "jpg",
        "transparent": "false",
        "f": "image",
    }
    return EXPORT_URL + "?" + urllib.parse.urlencode(params)


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
        payload = json.loads(request(metadata_url(lat, lng)).decode("utf-8"))
        features = payload.get("features") or []
        return (features[0].get("attributes") or {}) if features else None
    except Exception:
        return None


def annotate(image: Image.Image, target: Dict[str, Any], metadata: Dict[str, Any] | None) -> Image.Image:
    image = image.convert("RGB")
    strip_h = 88
    canvas = Image.new("RGB", (image.width, image.height + strip_h), "white")
    canvas.paste(image, (0, 0))
    draw = ImageDraw.Draw(canvas)
    name = str(target.get("name") or target.get("parking_id"))
    region = str(target.get("region") or "")
    line1 = f"{region} | {name}"[:100]
    line2 = f"{target.get('parking_id')} | {target.get('latitude'):.6f}, {target.get('longitude'):.6f}"[:120]
    meta_copy = "Imagery metadata unavailable"
    if metadata:
        source = metadata.get("Source") or metadata.get("SRC_NAME") or metadata.get("NICE_NAME")
        date = metadata.get("AcquisitionDate") or metadata.get("SRC_DATE2") or metadata.get("SRC_DATE")
        resolution = metadata.get("Resolution") or metadata.get("SRC_RES") or metadata.get("RESOLUTION")
        meta_copy = f"Source: {source or 'see Esri attribution'} | date: {date or 'unknown'} | resolution: {resolution or 'unknown'}"
    draw.text((12, image.height + 8), line1, fill="black")
    draw.text((12, image.height + 30), line2, fill="black")
    draw.text((12, image.height + 52), meta_copy[:130], fill="black")
    draw.text((12, image.height + 70), "Internal physical-supply review only; not live occupancy or legal-access proof.", fill="black")
    return canvas


def contact_sheet(images: List[tuple[Dict[str, Any], Path]], output: Path, columns: int = 3):
    if not images:
        return
    thumbs = []
    for target, path in images:
        im = Image.open(path).convert("RGB")
        im.thumbnail((360, 344))
        tile = Image.new("RGB", (370, 354), "white")
        tile.paste(im, ((370 - im.width) // 2, 4))
        thumbs.append(tile)
    rows = math.ceil(len(thumbs) / columns)
    sheet = Image.new("RGB", (columns * 370, rows * 354), "white")
    for index, tile in enumerate(thumbs):
        x = (index % columns) * 370
        y = (index // columns) * 354
        sheet.paste(tile, (x, y))
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
        "schema_version": "1.0",
        "retrieved_at": now_z(),
        "imagery_provider": "Esri World Imagery",
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
            "imagery_url_template": EXPORT_URL,
        })
        try:
            raw = request(imagery_url(lat, lng))
            image = Image.open(io.BytesIO(raw))
            metadata = fetch_metadata(lat, lng)
            annotated = annotate(image, target, metadata)
            annotated.save(path, quality=92)
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
