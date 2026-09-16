import json
import math

import httpx
from fastapi import HTTPException

from app.core.config import ROUTING_PROVIDER, ROUTING_TIMEOUT_SECONDS, ROUTING_URL


def _decode_polyline6(encoded: str) -> list[dict[str, float]]:
    coordinates: list[dict[str, float]] = []
    latitude = 0
    longitude = 0
    index = 0
    while index < len(encoded):
        deltas: list[int] = []
        for _ in range(2):
            result = 0
            shift = 0
            while True:
                if index >= len(encoded):
                    raise ValueError("Geometría Valhalla incompleta")
                value = ord(encoded[index]) - 63
                index += 1
                result |= (value & 0x1F) << shift
                shift += 5
                if value < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        latitude += deltas[0]
        longitude += deltas[1]
        coordinates.append({"latitude": latitude / 1_000_000, "longitude": longitude / 1_000_000})
    return coordinates


def _valid_number(value) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("El motor devolvió una medida inválida")
    return max(0.0, number)


_OSRM_ACTIONS = {
    "depart": "Inicia el recorrido", "arrive": "Has llegado a tu destino",
    "turn": "Gira", "continue": "Continúa", "new name": "Continúa",
    "merge": "Incorpórate", "fork": "Toma la bifurcación",
    "on ramp": "Toma la entrada", "off ramp": "Toma la salida",
    "roundabout": "En la glorieta continúa", "rotary": "En la glorieta continúa",
    "notification": "Atención", "end of road": "Al final de la vía gira",
}
_OSRM_DIRECTIONS = {
    "left": "a la izquierda", "right": "a la derecha",
    "slight left": "levemente a la izquierda", "slight right": "levemente a la derecha",
    "sharp left": "pronunciadamente a la izquierda", "sharp right": "pronunciadamente a la derecha",
    "straight": "recto", "uturn": "en U",
}


def _osrm_instruction(step: dict) -> str:
    maneuver = step.get("maneuver") or {}
    action = _OSRM_ACTIONS.get(maneuver.get("type"), "Continúa")
    direction = _OSRM_DIRECTIONS.get(maneuver.get("modifier"), "")
    road = f' por {step["name"]}' if step.get("name") else ""
    exit_text = f' y toma la salida {maneuver["exit"]}' if maneuver.get("exit") else ""
    return f"{action}{f' {direction}' if direction else ''}{road}{exit_text}".strip()


def normalize_osrm_route(data: dict, etapa: str) -> dict:
    route = (data.get("routes") or [None])[0]
    coordinates = ((route or {}).get("geometry") or {}).get("coordinates") or []
    if len(coordinates) < 2:
        raise ValueError("OSRM no devolvió una ruta vial")
    points = [{"latitude": float(latitude), "longitude": float(longitude)} for longitude, latitude in coordinates]
    instructions = []
    for leg in route.get("legs") or []:
        for step in leg.get("steps") or []:
            maneuver = step.get("maneuver") or {}
            location = maneuver.get("location") or []
            instructions.append({
                "texto": _osrm_instruction(step),
                "distancia_m": _valid_number(step.get("distance", 0)),
                "duracion_s": _valid_number(step.get("duration", 0)),
                "coordenada": ({"latitude": float(location[1]), "longitude": float(location[0])}
                                if len(location) == 2 else None),
            })
    return {
        "etapa": etapa, "proveedor": "osrm", "puntos": points,
        "instrucciones": instructions,
        "distancia_m": _valid_number(route.get("distance", 0)),
        "duracion_s": _valid_number(route.get("duration", 0)),
    }


def normalize_valhalla_route(data: dict, etapa: str) -> dict:
    trip = data.get("trip") or {}
    legs = trip.get("legs") or []
    if not legs:
        raise ValueError("Valhalla no devolvió una ruta vial")
    points: list[dict[str, float]] = []
    instructions = []
    for leg in legs:
        leg_points = _decode_polyline6(leg.get("shape") or "")
        if points and leg_points and points[-1] == leg_points[0]:
            leg_points = leg_points[1:]
        leg_offset = len(points)
        points.extend(leg_points)
        for maneuver in leg.get("maneuvers") or []:
            shape_index = leg_offset + int(maneuver.get("begin_shape_index", 0))
            coordinate = points[shape_index] if 0 <= shape_index < len(points) else None
            instructions.append({
                "texto": str(maneuver.get("instruction") or maneuver.get("verbal_pre_transition_instruction") or "Continúa"),
                "distancia_m": _valid_number(maneuver.get("length", 0)) * 1000,
                "duracion_s": _valid_number(maneuver.get("time", 0)),
                "coordenada": coordinate,
            })
    if len(points) < 2:
        raise ValueError("Valhalla devolvió una geometría incompleta")
    summary = trip.get("summary") or {}
    return {
        "etapa": etapa, "proveedor": "valhalla", "puntos": points,
        "instrucciones": instructions,
        "distancia_m": _valid_number(summary.get("length", 0)) * 1000,
        "duracion_s": _valid_number(summary.get("time", 0)),
    }


async def calculate_navigation_route(origin: dict, destination: dict, etapa: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=ROUTING_TIMEOUT_SECONDS) as client:
            if ROUTING_PROVIDER == "valhalla":
                payload = {
                    "locations": [
                        {"lat": origin["latitude"], "lon": origin["longitude"], "type": "break"},
                        {"lat": destination["latitude"], "lon": destination["longitude"], "type": "break"},
                    ],
                    "costing": "auto",
                    "directions_options": {"language": "es-ES", "units": "kilometers"},
                }
                response = await client.post(f"{ROUTING_URL}/route", json=payload)
                if response.status_code == 405:
                    response = await client.get(f"{ROUTING_URL}/route", params={"json": json.dumps(payload)})
                response.raise_for_status()
                return normalize_valhalla_route(response.json(), etapa)
            coordinates = (
                f'{origin["longitude"]},{origin["latitude"]};'
                f'{destination["longitude"]},{destination["latitude"]}'
            )
            response = await client.get(
                f"{ROUTING_URL}/route/v1/driving/{coordinates}",
                params={"overview": "full", "geometries": "geojson", "steps": "true"},
            )
            response.raise_for_status()
            return normalize_osrm_route(response.json(), etapa)
    except (httpx.HTTPError, ValueError, TypeError, KeyError) as error:
        raise HTTPException(status_code=503, detail="No se pudo calcular una ruta vial en este momento") from error
