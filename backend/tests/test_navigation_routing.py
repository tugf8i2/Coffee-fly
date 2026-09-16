import pytest

from app.services.navegacion_services import normalize_osrm_route, normalize_valhalla_route


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
