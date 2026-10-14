"""Cartografía vectorial propia para paquetes MapLibre sin conexión."""

import json
import os
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response


router = APIRouter(prefix="/maps", tags=["mapas"])
ASSETS = Path(__file__).resolve().parents[1] / "static_maps"
MAP_DATABASE = Path(os.getenv("COFFEE_FLY_MAP_DB", "/app/maps/coffee-fly-colombia.mbtiles"))
PUBLIC_URL = os.getenv("COFFEE_FLY_MAP_PUBLIC_URL", "https://coffee-fly.hostless.app").rstrip("/")
FONT_NAME = "Noto Sans Regular"


def _protobuf_string(field: int, value: str) -> bytes:
    encoded = value.encode("utf-8")
    size = len(encoded)
    length = bytearray()
    while size >= 128:
        length.append((size & 0x7f) | 0x80)
        size >>= 7
    length.append(size)
    return bytes([(field << 3) | 2]) + bytes(length) + encoded


def ensure_map() -> None:
    if not MAP_DATABASE.is_file():
        raise HTTPException(status_code=503, detail="La cartografía aún no está instalada.")


@router.get("/styles/coffee-fly/style.json", include_in_schema=False)
def map_style():
    ensure_map()
    style = json.loads((ASSETS / "coffee-fly.json").read_text(encoding="utf-8"))
    style["glyphs"] = f"{PUBLIC_URL}/maps/fonts/{{fontstack}}/{{range}}.pbf"
    style["sources"]["coffee-fly-colombia"] = {
        "type": "vector",
        "url": f"{PUBLIC_URL}/maps/data/coffee-fly-colombia.json",
    }
    return JSONResponse(style, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/data/coffee-fly-colombia.json", include_in_schema=False)
def map_source():
    ensure_map()
    return JSONResponse({
        "tilejson": "3.0.0",
        "name": "Coffee Fly Colombia",
        "attribution": "© OpenMapTiles © OpenStreetMap contributors",
        "scheme": "xyz",
        "minzoom": 0,
        "maxzoom": 14,
        "bounds": [-83.23104, -4.25732, -66.81472, 16.59407],
        "tiles": [f"{PUBLIC_URL}/maps/data/coffee-fly-colombia/{{z}}/{{x}}/{{y}}.pbf"],
    }, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/data/coffee-fly-colombia/{z}/{x}/{y}.pbf", include_in_schema=False)
def map_tile(z: int, x: int, y: int):
    ensure_map()
    if not 0 <= z <= 14 or not 0 <= x < 2**z or not 0 <= y < 2**z:
        raise HTTPException(status_code=404, detail="Tesela fuera del mapa.")
    tms_y = (2**z - 1) - y
    with sqlite3.connect(str(MAP_DATABASE)) as db:
        row = db.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
            (z, x, tms_y),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Tesela no disponible.")
    return Response(
        row[0],
        media_type="application/x-protobuf",
        headers={"Content-Encoding": "gzip", "Cache-Control": "public, max-age=86400"},
    )


@router.get("/fonts/{fontstack}/{glyph_range}.pbf", include_in_schema=False)
def map_glyphs(fontstack: str, glyph_range: str):
    if fontstack != FONT_NAME:
        raise HTTPException(status_code=404, detail="Fuente no disponible.")
    try:
        first, last = (int(part) for part in glyph_range.split("-"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Rango de fuente inválido.") from None
    if first < 0 or first > 65280 or first % 256 or last != first + 255:
        raise HTTPException(status_code=404, detail="Rango de fuente inválido.")
    glyph_file = ASSETS / "fonts" / FONT_NAME / f"{glyph_range}.pbf"
    # MapLibre descarga todos los rangos Unicode al guardar un estilo offline.
    # Los rangos sin glifos deben ser PBF válidos y vacíos, no respuestas 404.
    data = glyph_file.read_bytes() if glyph_file.is_file() else (
        _protobuf_string(1, FONT_NAME) + _protobuf_string(2, glyph_range)
    )
    return Response(data, media_type="application/x-protobuf", headers={"Cache-Control": "public, max-age=86400"})
