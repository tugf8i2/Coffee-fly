import gzip
import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import mapas_api


def test_map_style_tiles_and_glyphs_work_without_public_tile_service(tmp_path, monkeypatch):
    database = tmp_path / "colombia.mbtiles"
    with sqlite3.connect(database) as connection:
        connection.execute(
            "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)"
        )
        connection.execute(
            "INSERT INTO tiles VALUES (?, ?, ?, ?)", (1, 1, 1, gzip.compress(b"vector tile"))
        )
    monkeypatch.setattr(mapas_api, "MAP_DATABASE", database)
    monkeypatch.setattr(mapas_api, "PUBLIC_URL", "https://coffee-fly.example")
    app = FastAPI()
    app.include_router(mapas_api.router)
    client = TestClient(app)

    style = client.get("/maps/styles/coffee-fly/style.json")
    assert style.status_code == 200
    assert style.json()["sources"]["coffee-fly-colombia"]["url"] == (
        "https://coffee-fly.example/maps/data/coffee-fly-colombia.json"
    )
    source = client.get("/maps/data/coffee-fly-colombia.json")
    assert source.json()["tiles"][0].startswith("https://coffee-fly.example/maps/")
    tile = client.get("/maps/data/coffee-fly-colombia/1/1/0.pbf")
    assert tile.status_code == 200
    assert tile.content == b"vector tile"
    assert client.get("/maps/fonts/Noto%20Sans%20Regular/0-255.pbf").status_code == 200
    assert client.get("/maps/data/coffee-fly-colombia/1/1/1.pbf").status_code == 404
    assert client.get("/maps/fonts/Other/0-255.pbf").status_code == 404
