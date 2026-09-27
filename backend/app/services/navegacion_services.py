import json
import math
import time

import httpx
from fastapi import HTTPException

from app.core.config import ROUTING_PROVIDER, ROUTING_TIMEOUT_SECONDS, ROUTING_URL
from app.core.observability import process_metrics
from app.core.time import as_utc_aware


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
    started = time.perf_counter()
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
                result = normalize_valhalla_route(response.json(), etapa)
                process_metrics.increment("route_requests_success")
                return result
            coordinates = (
                f'{origin["longitude"]},{origin["latitude"]};'
                f'{destination["longitude"]},{destination["latitude"]}'
            )
            response = await client.get(
                f"{ROUTING_URL}/route/v1/driving/{coordinates}",
                params={"overview": "full", "geometries": "geojson", "steps": "true"},
            )
            response.raise_for_status()
            result = normalize_osrm_route(response.json(), etapa)
            process_metrics.increment("route_requests_success")
            return result
    except (httpx.HTTPError, ValueError, TypeError, KeyError) as error:
        process_metrics.increment("route_requests_failure")
        raise HTTPException(status_code=503, detail="No se pudo calcular una ruta vial en este momento") from error
    finally:
        process_metrics.observe("route_request_duration_ms", (time.perf_counter() - started) * 1000)


async def navigation_health() -> dict:
    started = time.perf_counter()
    path = "/status" if ROUTING_PROVIDER == "valhalla" else (
        "/route/v1/driving/-75.6811,4.5339;-75.6805,4.5342"
    )
    params = None if ROUTING_PROVIDER == "valhalla" else {"overview": "false", "steps": "false"}
    try:
        async with httpx.AsyncClient(timeout=min(ROUTING_TIMEOUT_SECONDS, 5)) as client:
            response = await client.get(f"{ROUTING_URL}{path}", params=params)
        available = response.status_code < 500
        return {
            "status": "ok" if available else "degraded",
            "api": "ok",
            "routing": {
                "provider": ROUTING_PROVIDER,
                "status": "available" if available else "unavailable",
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        }
    except httpx.HTTPError:
        return {
            "status": "degraded",
            "api": "ok",
            "routing": {
                "provider": ROUTING_PROVIDER,
                "status": "unavailable",
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        }


def normalize_osrm_match(data: dict, points: list[dict]) -> dict:
    tracepoints = data.get("tracepoints") or []
    matchings = data.get("matchings") or []
    results = []
    for index, source in enumerate(points):
        matched = tracepoints[index] if index < len(tracepoints) else None
        location = (matched or {}).get("location") or []
        matching_index = (matched or {}).get("matchings_index")
        confidence = None
        if isinstance(matching_index, int) and 0 <= matching_index < len(matchings):
            confidence = max(0.0, min(1.0, float(matchings[matching_index].get("confidence", 0))))
        valid = matched is not None and len(location) == 2
        results.append({
            "rawLatitude": source["latitude"],
            "rawLongitude": source["longitude"],
            "matchedLatitude": float(location[1]) if valid else None,
            "matchedLongitude": float(location[0]) if valid else None,
            "confidence": confidence,
            "distanceFromRoadM": None,
            "matched": valid,
        })
    return {"provider": "osrm", "points": results}


def normalize_valhalla_match(data: dict, points: list[dict]) -> dict:
    matched_points = data.get("matched_points") or []
    results = []
    for index, source in enumerate(points):
        matched = matched_points[index] if index < len(matched_points) else {}
        valid = matched.get("type") != "unmatched" and matched.get("lat") is not None and matched.get("lon") is not None
        distance = float(matched["distance_from_trace_point"]) if valid and matched.get("distance_from_trace_point") is not None else None
        confidence = None
        if valid and distance is not None:
            confidence = max(0.0, min(1.0, 1 - distance / max(30.0, source.get("accuracy", 20) * 3)))
        results.append({
            "rawLatitude": source["latitude"],
            "rawLongitude": source["longitude"],
            "matchedLatitude": float(matched["lat"]) if valid else None,
            "matchedLongitude": float(matched["lon"]) if valid else None,
            "confidence": confidence,
            "distanceFromRoadM": distance,
            "matched": valid,
        })
    return {"provider": "valhalla", "points": results}


async def map_match_navigation(points: list[dict]) -> dict:
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=ROUTING_TIMEOUT_SECONDS) as client:
            if ROUTING_PROVIDER == "valhalla":
                accuracies = [max(1.0, min(100.0, float(point.get("accuracy", 20)))) for point in points]
                shape = []
                for point in points:
                    item = {"lat": point["latitude"], "lon": point["longitude"]}
                    if point.get("capturedAt") is not None:
                        item["time"] = int(as_utc_aware(point["capturedAt"]).timestamp())
                    shape.append(item)
                response = await client.post(f"{ROUTING_URL}/trace_attributes", json={
                    "shape": shape,
                    "costing": "auto",
                    "shape_match": "map_snap",
                    "trace_options": {
                        "gps_accuracy": round(sum(accuracies) / len(accuracies), 1),
                        "search_radius": min(100, max(accuracies) * 2),
                    },
                    "filters": {
                        "action": "include",
                        "attributes": [
                            "matched.point", "matched.type", "matched.edge_index",
                            "matched.distance_along_edge", "matched.distance_from_trace_point",
                        ],
                    },
                })
                response.raise_for_status()
                result = normalize_valhalla_match(response.json(), points)
            else:
                coordinates = ";".join(f'{point["longitude"]},{point["latitude"]}' for point in points)
                params = {
                    "overview": "false",
                    "steps": "false",
                    "tidy": "true",
                    "radiuses": ";".join(str(max(5, min(100, round(point.get("accuracy", 20) * 2)))) for point in points),
                }
                if all(point.get("capturedAt") is not None for point in points):
                    params["timestamps"] = ";".join(
                        str(int(as_utc_aware(point["capturedAt"]).timestamp())) for point in points
                    )
                response = await client.get(f"{ROUTING_URL}/match/v1/driving/{coordinates}", params=params)
                response.raise_for_status()
                result = normalize_osrm_match(response.json(), points)
        process_metrics.increment("map_match_success")
        return result
    except (httpx.HTTPError, ValueError, TypeError, KeyError) as error:
        process_metrics.increment("map_match_failure")
        raise HTTPException(status_code=503, detail="No se pudo ajustar la traza GPS a la red vial") from error
    finally:
        process_metrics.observe("map_match_duration_ms", (time.perf_counter() - started) * 1000)
