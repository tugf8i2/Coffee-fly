"""Recorrido E2E real de Coffee Fly contra FastAPI y PostgreSQL locales.

El registrador se crea directamente solo para arrancar la prueba. El resto del
flujo de negocio se ejecuta exclusivamente mediante la API pública.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth_session_models import AuthSession
from app.models.carga_models import Carga
from app.models.conductor_models import Conductor
from app.models.cooperativa_models import Cooperativa
from app.models.entrega_models import Entrega
from app.models.historial_asignacion_models import HistorialAsignacion
from app.models.historial_estado_entrega_models import HistorialEstadoEntrega
from app.models.historial_eventos_models import HistorialEvento
from app.models.rol_models import Rol
from app.models.seguimiento_ubicacion_models import SeguimientoUbicacion
from app.models.solicitud_models import Solicitud
from app.models.ubicacion_models import Ubicacion
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo
from app.models.viaje_models import Viaje


API_URL = "http://127.0.0.1:8000"
PASSWORD = "Admin123"
FARM = {"latitud": 4.5331, "longitud": -75.6819}
COOPERATIVE = {"latitud": 4.5402, "longitud": -75.6722}


def expect(response, status=200):
    assert response.status_code == status, (
        f"{response.request.method} {response.request.url}: "
        f"esperado {status}, recibido {response.status_code}: {response.text}"
    )
    return response.json()


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def cleanup(ids):
    db = SessionLocal()
    try:
        user_ids = ids.get("user_ids", [])
        if user_ids:
            db.query(AuthSession).filter(AuthSession.user_id.in_(user_ids)).delete(synchronize_session=False)
        delivery_id = ids.get("delivery_id")
        if delivery_id:
            db.query(SeguimientoUbicacion).filter(SeguimientoUbicacion.entrega_id == delivery_id).delete(synchronize_session=False)
            db.query(HistorialEvento).filter(HistorialEvento.entrega_id == delivery_id).delete(synchronize_session=False)
            db.query(HistorialEstadoEntrega).filter(HistorialEstadoEntrega.entrega_id == delivery_id).delete(synchronize_session=False)
            db.query(HistorialAsignacion).filter(HistorialAsignacion.entrega_id == delivery_id).delete(synchronize_session=False)
            db.query(Entrega).filter(Entrega.id_entrega == delivery_id).delete(synchronize_session=False)
        trip_id = ids.get("trip_id")
        if trip_id:
            db.query(Viaje).filter(Viaje.id_viaje == trip_id).delete(synchronize_session=False)
        request_id = ids.get("request_id")
        if request_id:
            db.query(Solicitud).filter(Solicitud.id_solicitud == request_id).delete(synchronize_session=False)
        load_id = ids.get("load_id")
        if load_id:
            db.query(Carga).filter(Carga.id_carga == load_id).delete(synchronize_session=False)
        vehicle_id = ids.get("vehicle_id")
        if vehicle_id:
            db.query(Vehiculo).filter(Vehiculo.id_vehiculo == vehicle_id).delete(synchronize_session=False)
        driver_id = ids.get("driver_id")
        if driver_id:
            db.query(Conductor).filter(Conductor.id_conductor == driver_id).delete(synchronize_session=False)
        cooperative_id = ids.get("cooperative_id")
        if cooperative_id:
            db.query(Cooperativa).filter(Cooperativa.id_cooperativa == cooperative_id).delete(synchronize_session=False)
        location_id = ids.get("location_id")
        if location_id:
            db.query(Ubicacion).filter(Ubicacion.id_ubicacion == location_id).delete(synchronize_session=False)
        if user_ids:
            db.query(Usuario).filter(Usuario.id_usuario.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main():
    suffix = uuid4().hex[:6]
    ids = {"user_ids": []}
    registrador_email = f"reg{suffix}@coffeefly.com"
    db = SessionLocal()
    try:
        role = db.query(Rol).filter(Rol.descripcion_rol.ilike("registrador")).first()
        assert role is not None
        registrador = Usuario(
            nombre_usuario="Registro", apellido=suffix,
            correo_usuario=registrador_email, telefono_usuario="3100000001",
            contrasena=hash_password(PASSWORD), rol_id=role.id_rol,
        )
        db.add(registrador)
        db.commit()
        db.refresh(registrador)
        ids["user_ids"].append(registrador.id_usuario)
    finally:
        db.close()

    try:
        with httpx.Client(base_url=API_URL, timeout=15) as client:
            login = expect(client.post("/login", json={"email": registrador_email, "password": PASSWORD}))
            registrador_headers = headers(login["access_token"])
            roles = {
                item["descripcion_rol"].lower(): item["id_rol"]
                for item in expect(client.get("/roles/", headers=registrador_headers))
            }

            cooperative = expect(client.post("/cooperativas/", headers=registrador_headers, json={
                "nombre": f"Cooperativa E2E {suffix}",
                "telefono": "3100000002",
                "correo": f"coop{suffix}@example.com",
                "ubicacion": {
                    "x": COOPERATIVE["longitud"], "y": COOPERATIVE["latitud"],
                    "departamento": "Quindío", "ciudad": "Armenia",
                    "direccion": "Centro de acopio E2E",
                },
            }))
            ids["cooperative_id"] = cooperative["id_cooperativa"]
            ids["location_id"] = cooperative["ubicacion_id"]

            base_user = {
                "contrasena": PASSWORD,
                "telefono_usuario": "3100000003",
            }
            coordinator_email = f"coord{suffix}@coffeefly.com"
            coordinator = expect(client.post("/usuarios/", headers=registrador_headers, json={
                **base_user, "nombre_usuario": "Coordinador", "apellido": suffix,
                "correo_usuario": coordinator_email, "rol_id": roles["coordinador"],
            }))
            ids["user_ids"].append(coordinator["id_usuario"])

            farmer_email = f"cafe{suffix}@coffeefly.com"
            farmer = expect(client.post("/usuarios/", headers=registrador_headers, json={
                **base_user, "telefono_usuario": "3100000004",
                "nombre_usuario": "Caficultor", "apellido": suffix,
                "correo_usuario": farmer_email, "rol_id": roles["caficultor"],
                "departamento": "Quindío", "municipio": "Armenia", "vereda": "El Caimo",
            }))
            ids["user_ids"].append(farmer["id_usuario"])

            driver_email = f"driver{suffix}@coffeefly.com"
            driver = expect(client.post("/usuarios/", headers=registrador_headers, json={
                **base_user, "telefono_usuario": "3100000005",
                "nombre_usuario": "Conductor", "apellido": suffix,
                "correo_usuario": driver_email, "rol_id": roles["conductor"],
                "licencia": "C2", "foto_licencia": "data:image/png;base64,iVBORw0KGgo=",
            }))
            ids["user_ids"].append(driver["id_usuario"])
            available_drivers = expect(client.get("/vehiculos/conductores-disponibles", headers=registrador_headers))
            driver_profile = next(item for item in available_drivers if item["nombre"].endswith(suffix))
            ids["driver_id"] = driver_profile["id_conductor"]

            vehicle = expect(client.post("/vehiculos/", headers=registrador_headers, json={
                "placa": f"E{suffix}"[:7], "tipo_vehiculo": "Camión", "modelo": "2024",
                "capacidad_kg": 5000, "estado_vehiculo": "disponible",
                "conductor_id": ids["driver_id"],
            }))
            ids["vehicle_id"] = vehicle["id_vehiculo"]

            farmer_token = expect(client.post("/login", json={"email": farmer_email, "password": PASSWORD}))["access_token"]
            farmer_headers = headers(farmer_token)
            expect(client.put("/usuarios/mi-ubicacion", headers=farmer_headers, json={
                **FARM, "direccion": "Finca E2E, vereda El Caimo",
            }))
            assert client.get("/usuarios/", headers=farmer_headers).status_code == 403

            client_request_id = str(uuid4())
            captured_at = datetime.now(timezone.utc).isoformat()
            request_payload = {
                "client_request_id": client_request_id,
                "grupos_bultos": [{"peso_bulto_kg": 60, "cantidad_bultos": 10}],
                "observacion": "Carga E2E", "capturada_en": captured_at,
            }
            request = expect(client.post("/solicitudes/sincronizar", headers=farmer_headers, json=request_payload))
            ids["request_id"], ids["load_id"] = request["solicitud_id"], request["carga_id"]
            duplicate_request = expect(client.post("/solicitudes/sincronizar", headers=farmer_headers, json=request_payload))
            assert duplicate_request["estado"] == "duplicada"

            coordinator_token = expect(client.post("/login", json={"email": coordinator_email, "password": PASSWORD}))["access_token"]
            coordinator_headers = headers(coordinator_token)
            active_requests = expect(client.get("/entregas/solicitudes-activas", headers=coordinator_headers))
            assert any(item["id_solicitud"] == ids["request_id"] for item in active_requests)
            delivery = expect(client.post("/entregas/", headers=coordinator_headers, json={
                "solicitud_id": ids["request_id"],
                "fecha_hora_entrega": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "observaciones": "Recolección E2E",
            }), 201)
            ids["delivery_id"] = delivery["id_entrega"]
            pending = expect(client.get("/entregas/pendientes-asignacion", headers=coordinator_headers))
            assert any(item["id_entrega"] == ids["delivery_id"] for item in pending)

            trip = expect(client.post("/viajes/", headers=coordinator_headers, json={
                "entrega_ids": [ids["delivery_id"]], "vehiculo_id": ids["vehicle_id"],
                "conductor_id": ids["driver_id"], "cooperativa_id": ids["cooperative_id"],
            }), 201)
            ids["trip_id"] = trip["id_viaje"]
            assert trip["estado_viaje"] == "asignado" and trip["puede_iniciar"]

            driver_token = expect(client.post("/login", json={"email": driver_email, "password": PASSWORD}))["access_token"]
            driver_headers = headers(driver_token)
            assigned = expect(client.get("/viajes/mis-asignados", headers=driver_headers))
            assert any(item["id_viaje"] == ids["trip_id"] for item in assigned)
            started = expect(client.post(f"/viajes/{ids['trip_id']}/iniciar", headers=driver_headers))
            assert started["estado_viaje"] == "en_camino"

            tracking = expect(client.get("/entregas/mi-seguimiento", headers=farmer_headers))
            assert tracking["recoleccion_latitud"] == FARM["latitud"]
            assert tracking["cooperativa_latitud"] == COOPERATIVE["latitud"]

            farm_point_id = str(uuid4())
            farm_point = {
                "client_point_id": farm_point_id, **FARM, "precision_m": 3,
                "velocidad_m_s": 0, "rumbo_grados": 90,
                "capturada_en": (datetime.now(timezone.utc) - timedelta(seconds=120)).isoformat(),
            }
            first_gps = expect(client.post(
                f"/entregas/{ids['delivery_id']}/ubicacion", headers=driver_headers, json=farm_point
            ))
            assert first_gps["estado"] == "guardado"
            duplicate_gps = expect(client.post(
                f"/entregas/{ids['delivery_id']}/ubicacion", headers=driver_headers, json=farm_point
            ))
            assert duplicate_gps["estado"] == "duplicado"
            pickup = expect(client.post(
                f"/entregas/{ids['delivery_id']}/confirmar-carga", headers=driver_headers
            ))
            assert pickup["etapa_viaje"] == "hacia_cooperativa"

            cooperative_point = {
                "client_point_id": str(uuid4()), **COOPERATIVE, "precision_m": 3,
                "velocidad_m_s": 8, "rumbo_grados": 45,
                "capturada_en": datetime.now(timezone.utc).isoformat(),
            }
            expect(client.post(
                f"/entregas/{ids['delivery_id']}/ubicacion", headers=driver_headers, json=cooperative_point
            ))
            completed = expect(client.post(f"/viajes/{ids['trip_id']}/completar", headers=driver_headers))
            assert completed["estado_viaje"] == "completado"
            assert completed["cargas"][0]["estado_entrega"] == "entregado"

            coordinator_history = expect(client.get(
                "/entregas/historial?estado=entregado", headers=coordinator_headers
            ))
            assert any(item["id_entrega"] == ids["delivery_id"] for item in coordinator_history["items"])
            farmer_dashboard = expect(client.get("/solicitudes/mis-solicitudes", headers=farmer_headers))
            assert any(
                item["id_solicitud"] == ids["request_id"]
                for item in farmer_dashboard["historial_despachos"]
            )
            final_vehicle = expect(client.get(f"/vehiculos/{ids['vehicle_id']}", headers=registrador_headers))
            assert final_vehicle["estado_vehiculo"] == "disponible"
            assert final_vehicle["conductor_id"] is None
            assert expect(client.get("/viajes/mi-activo", headers=driver_headers)) == []

            print(
                "LIVE_FULL_FLOW_OK registro + solicitud idempotente + asignacion + "
                "GPS idempotente + geocercas + cierre + historiales + liberacion"
            )
    finally:
        cleanup(ids)


if __name__ == "__main__":
    main()
