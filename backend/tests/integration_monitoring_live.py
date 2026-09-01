"""Comprueba monitoreo operativo contra FastAPI/PostgreSQL locales."""

from datetime import datetime, timezone
from uuid import uuid4

import httpx

from integration_realtime_live import API_URL, PASSWORD, cleanup, seed


def main():
    data = seed()
    try:
        with httpx.Client(base_url=API_URL, timeout=15) as client:
            coordinator = client.post(
                "/login", json={"email": data["coordinator_email"], "password": PASSWORD}
            )
            coordinator.raise_for_status()
            coordinator_headers = {
                "Authorization": f"Bearer {coordinator.json()['access_token']}"
            }
            driver = client.post(
                "/login", json={"email": data["driver_email"], "password": PASSWORD}
            )
            driver.raise_for_status()
            driver_headers = {"Authorization": f"Bearer {driver.json()['access_token']}"}

            initial = client.get("/monitoreo/resumen", headers=coordinator_headers)
            initial.raise_for_status()
            initial_vehicle = next(
                item for item in initial.json()["vehiculos"]
                if item["entrega_id"] == str(data["delivery_id"])
            )
            assert initial_vehicle["estado_gps"] == "sin_ubicacion"

            valid = {
                "client_point_id": str(uuid4()),
                "latitud": 4.711,
                "longitud": -74.0721,
                "precision_m": 10,
                "velocidad_m_s": 3,
                "rumbo_grados": 90,
                "capturada_en": datetime.now(timezone.utc).isoformat(),
            }
            invalid = {**valid, "client_point_id": str(uuid4()), "precision_m": 151}
            batch = client.post(
                f"/entregas/{data['delivery_id']}/ubicaciones/sincronizar",
                headers=driver_headers,
                json={"puntos": [valid, invalid]},
            )
            batch.raise_for_status()
            assert batch.json()["guardados"] == 1
            assert batch.json()["rechazados"] == 1

            summary = client.get("/monitoreo/resumen", headers=coordinator_headers)
            summary.raise_for_status()
            payload = summary.json()
            vehicle = next(
                item for item in payload["vehiculos"]
                if item["entrega_id"] == str(data["delivery_id"])
            )
            assert vehicle["estado_gps"] == "actualizado"
            assert vehicle["latitud"] == valid["latitud"]
            assert vehicle["longitud"] == valid["longitud"]
            assert vehicle["precision_m"] == valid["precision_m"]
            assert vehicle["velocidad_m_s"] == valid["velocidad_m_s"]
            assert vehicle["rumbo_grados"] == valid["rumbo_grados"]
            assert payload["metricas_proceso"]["contadores"]["gps_points_rejected"] >= 1
            print("LIVE_MONITORING_OK mapa de flota + sin GPS + actualizado + rechazo visible")
    finally:
        cleanup(data)


if __name__ == "__main__":
    main()
