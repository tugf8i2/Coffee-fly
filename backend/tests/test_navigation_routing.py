import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from app.services.navegacion_services import (
    navigation_health,
    normalize_osrm_match,
    normalize_osrm_route,
    normalize_valhalla_match,
    normalize_valhalla_route,
)


def _encode_polyline6(points):
    output = []
    previous_latitude = 0
    previous_longitude = 0
    for latitude, longitude in points:
        values = [round(latitude * 1_000_000) - previous_latitude, round(longitude * 1_000_000) - previous_longitude]
        previous_latitude += values[0]
        previous_longitude += values[1]
        for delta in values:
            encoded = ~(delta << 1) if delta < 0 else delta << 1
            while encoded >= 0x20:
                output.append(chr((0x20 | (encoded & 0x1F)) + 63))
                encoded >>= 5
            output.append(chr(encoded + 63))
    return "".join(output)


def test_normalize_osrm_route_keeps_lng_lat_order_and_spanish_instruction():
    result = normalize_osrm_route({
        "routes": [{
            "distance": 1250.5,
            "duration": 180,
            "geometry": {"coordinates": [[-76.05, 1.85], [-76.04, 1.86]]},
            "legs": [{"steps": [{
                "distance": 250, "duration": 30, "name": "Vía Nacional",
                "maneuver": {"type": "turn", "modifier": "right", "location": [-76.04, 1.86]},
            }]}],
        }],
    }, "hacia_finca")

    assert result["proveedor"] == "osrm"
    assert result["puntos"][0] == {"latitude": 1.85, "longitude": -76.05}
    assert result["instrucciones"][0]["texto"] == "Gira a la derecha por Vía Nacional"
    assert result["distancia_m"] == pytest.approx(1250.5)


def test_normalize_valhalla_route_decodes_polyline6_and_converts_kilometers():
    shape = _encode_polyline6([(1.85, -76.05), (1.851, -76.049)])
    result = normalize_valhalla_route({
        "trip": {
            "summary": {"length": 1.25, "time": 180},
            "legs": [{
                "shape": shape,
                "maneuvers": [{
                    "instruction": "Gira a la derecha en Vía Nacional",
                    "length": 0.25, "time": 30, "begin_shape_index": 1,
                }],
            }],
        },
    }, "hacia_cooperativa")

    assert result["proveedor"] == "valhalla"
    assert result["puntos"][0]["latitude"] == pytest.approx(1.85)
    assert result["puntos"][0]["longitude"] == pytest.approx(-76.05)
    assert result["instrucciones"][0]["coordenada"] == result["puntos"][1]
    assert result["instrucciones"][0]["distancia_m"] == pytest.approx(250)
    assert result["distancia_m"] == pytest.approx(1250)


@pytest.mark.parametrize("normalizer,payload", [
    (normalize_osrm_route, {"routes": []}),
    (normalize_valhalla_route, {"trip": {"legs": []}}),
])
def test_route_normalizers_reject_missing_road_geometry(normalizer, payload):
    with pytest.raises(ValueError):
        normalizer(payload, "hacia_finca")


def test_navigation_health_reports_engine_availability_without_hiding_api():
    response = AsyncMock(status_code=200)
    with patch("app.services.navegacion_services.httpx.AsyncClient") as client:
        client.return_value.__aenter__.return_value.get.return_value = response
        result = asyncio.run(navigation_health())
    assert result["api"] == "ok"
    assert result["routing"]["status"] == "available"


def test_navigation_health_degrades_when_engine_is_unreachable():
    import httpx
    with patch("app.services.navegacion_services.httpx.AsyncClient") as client:
        client.return_value.__aenter__.return_value.get.side_effect = httpx.ConnectError("offline")
        result = asyncio.run(navigation_health())
    assert result["status"] == "degraded"
    assert result["api"] == "ok"
    assert result["routing"]["status"] == "unavailable"


def test_normalize_osrm_match_keeps_raw_and_matched_coordinates():
    points = [{"latitude": 4.5, "longitude": -75.7, "accuracy": 10}]
    result = normalize_osrm_match({
        "tracepoints": [{"location": [-75.7001, 4.5001], "matchings_index": 0}],
        "matchings": [{"confidence": 0.92}],
    }, points)
    assert result["points"][0] == {
        "rawLatitude": 4.5,
        "rawLongitude": -75.7,
        "matchedLatitude": 4.5001,
        "matchedLongitude": -75.7001,
        "confidence": pytest.approx(0.92),
        "distanceFromRoadM": None,
        "matched": True,
    }


def test_normalize_valhalla_match_does_not_snap_unmatched_points():
    points = [
        {"latitude": 4.5, "longitude": -75.7, "accuracy": 10},
        {"latitude": 4.6, "longitude": -75.6, "accuracy": 10},
    ]
    result = normalize_valhalla_match({"matched_points": [
        {"lat": 4.5001, "lon": -75.7001, "type": "matched", "distance_from_trace_point": 3},
        {"type": "unmatched"},
    ]}, points)
    assert result["points"][0]["matched"] is True
    assert result["points"][0]["confidence"] == pytest.approx(0.9)
    assert result["points"][1]["matched"] is False
    assert result["points"][1]["matchedLatitude"] is None
