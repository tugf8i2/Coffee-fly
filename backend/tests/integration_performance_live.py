"""Prueba manual de rendimiento del tamaño máximo de lote GPS."""
import time
from datetime import datetime, timedelta
from uuid import uuid4

import httpx
from sqlalchemy import event

from integration_realtime_live import API_URL, PASSWORD, cleanup, seed
from app.api.monitoring_api import resumen_operacional
from app.core.database import SessionLocal, engine
from app.services.entrega_services import EntregaService
from app.services.usuario_services import UsuarioService


def assert_vehicle_listing_single_query():
    statements = []

    def count_selects(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", count_selects)
    db = SessionLocal()
    try:
        EntregaService(db).obtener_vehiculos_disponibles()
    finally:
        db.close()
        event.remove(engine, "before_cursor_execute", count_selects)
    assert len(statements) == 1, f"Se esperaban 1 consulta y se ejecutaron {len(statements)}"


def assert_user_listing_single_query():
    statements = []

    def count_selects(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", count_selects)
    db = SessionLocal()
    try:
        UsuarioService(db).obtener_usuarios(limit=100)
    finally:
        db.close()
        event.remove(engine, "before_cursor_execute", count_selects)
    assert len(statements) == 1, (
        f"El listado de usuarios debía usar 1 consulta y ejecutó {len(statements)}"
    )


def assert_fleet_summary_single_query():
    statements = []

    def count_selects(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", count_selects)
    db = SessionLocal()
    try:
        resumen_operacional(db=db, _coordinador=None)
    finally:
        db.close()
        event.remove(engine, "before_cursor_execute", count_selects)
    assert len(statements) == 1, (
        f"El mapa de flota debía usar 1 consulta y ejecutó {len(statements)}"
    )


def main():
    assert_vehicle_listing_single_query()
    assert_user_listing_single_query()
    assert_fleet_summary_single_query()
    data = seed()
    try:
        with httpx.Client(base_url=API_URL, timeout=20) as client:
            driver_login = client.post(
                "/login",
                json={"email": data["driver_email"], "password": PASSWORD},
            )
            driver_login.raise_for_status()
            driver_headers = {"Authorization": f"Bearer {driver_login.json()['access_token']}"}
            coordinator_login = client.post(
                "/login",
                json={"email": data["coordinator_email"], "password": PASSWORD},
            )
            coordinator_login.raise_for_status()
            coordinator_headers = {"Authorization": f"Bearer {coordinator_login.json()['access_token']}"}

            started_at = datetime.now() - timedelta(hours=2)
            points = [{
                "client_point_id": str(uuid4()),
                "latitud": 4.7000 + index * 0.00005,
                "longitud": -74.0700,
                "precision_m": 12,
                "velocidad_m_s": 3,
                "rumbo_grados": 0,
                "capturada_en": (started_at + timedelta(seconds=index * 20)).isoformat(),
            } for index in range(200)]

            batch_started = time.perf_counter()
            response = client.post(
                f"/entregas/{data['delivery_id']}/ubicaciones/sincronizar",
                headers=driver_headers,
                json={"puntos": points},
            )
            batch_ms = (time.perf_counter() - batch_started) * 1000
            response.raise_for_status()
            result = response.json()
            assert result["guardados"] == 200
            assert result["rechazados"] == 0

            tracking_started = time.perf_counter()
            tracking_response = client.get(
                f"/entregas/{data['delivery_id']}/seguimiento",
                headers=coordinator_headers,
            )
            tracking_ms = (time.perf_counter() - tracking_started) * 1000
            tracking_response.raise_for_status()
            tracking = tracking_response.json()
            assert tracking["total_puntos"] == 200
            assert len(tracking["puntos"]) == 200
            assert tracking["distancia_recorrida_m"] > 1000
            assert len(tracking_response.content) < 200_000
            assert batch_ms < 5000
            assert tracking_ms < 2000
            print(
                f"LIVE_PERFORMANCE_OK batch200={batch_ms:.1f}ms "
                f"tracking={tracking_ms:.1f}ms bytes={len(tracking_response.content)} "
                "vehicle_n_plus_one=0 user_n_plus_one=0 fleet_n_plus_one=0"
            )
    finally:
        cleanup(data)


if __name__ == "__main__":
    main()
