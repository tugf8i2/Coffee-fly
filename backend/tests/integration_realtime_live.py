"""Prueba viva opcional contra FastAPI/PostgreSQL locales.

Requiere el servidor en http://127.0.0.1:8000. Crea datos con un sufijo único,
comprueba snapshot + publicación GPS y los elimina siempre en el bloque finally.
"""

import asyncio
import json
from datetime import datetime, timedelta
from uuid import uuid4

import httpx
import websockets

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth_session_models import AuthSession
from app.models.carga_models import Carga
from app.models.conductor_models import Conductor
from app.models.entrega_models import Entrega
from app.models.rol_models import Rol
from app.models.seguimiento_ubicacion_models import SeguimientoUbicacion
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo


API_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/seguimiento"
PASSWORD = "LiveTest-123"


def seed():
    suffix = uuid4().hex[:6]
    db = SessionLocal()
    try:
        roles = {item.descripcion_rol.lower(): item for item in db.query(Rol).all()}
        coordinator = Usuario(
            nombre_usuario="CoordTest", apellido=suffix,
            correo_usuario=f"c{suffix}@t.co", telefono_usuario="3000000001",
            contrasena=hash_password(PASSWORD), rol_id=roles["coordinador"].id_rol,
        )
        farmer = Usuario(
            nombre_usuario="CafeTest", apellido=suffix,
            correo_usuario=f"f{suffix}@t.co", telefono_usuario="3000000002",
            contrasena=hash_password(PASSWORD), rol_id=roles["caficultor"].id_rol,
            departamento="Caldas", municipio="Manizales", vereda="Prueba",
            latitud_finca=4.72, longitud_finca=-74.08,
        )
        driver_user = Usuario(
            nombre_usuario="DriverTest", apellido=suffix,
            correo_usuario=f"d{suffix}@t.co", telefono_usuario="3000000003",
            contrasena=hash_password(PASSWORD), rol_id=roles["conductor"].id_rol,
        )
        db.add_all([coordinator, farmer, driver_user])
        db.flush()
        driver = Conductor(
            licencia=f"L{suffix}", foto_licencia="test", usuario_id=driver_user.id_usuario
        )
        db.add(driver)
        db.flush()
        vehicle = Vehiculo(
            placa=f"T{suffix}"[:7], tipo_vehiculo="Camión", modelo="Prueba",
            capacidad_kg=5000, estado_vehiculo="en camino", conductor_id=driver.id_conductor,
        )
        db.add(vehicle)
        db.flush()
        load = Carga(
            peso_kg=100, descripcion="Prueba tiempo real", vehiculo_id=vehicle.id_vehiculo,
            estado_sincronizacion="sincronizado", actualizado_en=datetime.now(),
        )
        db.add(load)
        db.flush()
        request = Solicitud(
            estado_solicitud="en camino", fecha_hora_solicitud=datetime.now(),
            estado_sincronizacion="sincronizado", caficultor_id=farmer.id_usuario,
            carga_id=load.id_carga,
        )
        db.add(request)
        db.flush()
        delivery = Entrega(
            solicitud_id=request.id_solicitud, caficultor_id=farmer.id_usuario,
            cantidad_kg=100, fecha_hora_entrega=datetime.now(),
            observaciones="Prueba WebSocket", estado_entrega="en camino",
            actualizado_en=datetime.now(),
        )
        db.add(delivery)
        db.commit()
        return {
            "suffix": suffix,
            "user_ids": [coordinator.id_usuario, farmer.id_usuario, driver_user.id_usuario],
            "coordinator_email": coordinator.correo_usuario,
            "driver_email": driver_user.correo_usuario,
            "driver_id": driver.id_conductor,
            "vehicle_id": vehicle.id_vehiculo,
            "load_id": load.id_carga,
            "request_id": request.id_solicitud,
            "delivery_id": delivery.id_entrega,
        }
    finally:
        db.close()


def cleanup(data):
    db = SessionLocal()
    try:
        db.query(AuthSession).filter(AuthSession.user_id.in_(data["user_ids"])).delete(synchronize_session=False)
        db.query(SeguimientoUbicacion).filter(
            SeguimientoUbicacion.entrega_id == data["delivery_id"]
        ).delete(synchronize_session=False)
        db.query(Entrega).filter(Entrega.id_entrega == data["delivery_id"]).delete(synchronize_session=False)
        db.query(Solicitud).filter(Solicitud.id_solicitud == data["request_id"]).delete(synchronize_session=False)
        db.query(Carga).filter(Carga.id_carga == data["load_id"]).delete(synchronize_session=False)
        db.query(Vehiculo).filter(Vehiculo.id_vehiculo == data["vehicle_id"]).delete(synchronize_session=False)
        db.query(Conductor).filter(Conductor.id_conductor == data["driver_id"]).delete(synchronize_session=False)
        db.query(Usuario).filter(Usuario.id_usuario.in_(data["user_ids"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


async def login(client, email):
    response = await client.post("/login", json={"email": email, "password": PASSWORD})
    response.raise_for_status()
    return response.json()["access_token"]


async def run():
    data = seed()
    try:
        async with httpx.AsyncClient(base_url=API_URL, timeout=10) as client:
            coordinator_token = await login(client, data["coordinator_email"])
            driver_token = await login(client, data["driver_email"])
            async with websockets.connect(WS_URL) as socket:
                await socket.send(json.dumps({
                    "tipo": "autenticar",
                    "token": coordinator_token,
                    "entrega_id": str(data["delivery_id"]),
                }))
                snapshot = json.loads(await asyncio.wait_for(socket.recv(), timeout=5))
                assert snapshot["tipo"] == "snapshot"

                captured = datetime.now()
                points = [{
                    "client_point_id": str(uuid4()),
                    "latitud": 4.711 + index * 0.0001,
                    "longitud": -74.0721,
                    "precision_m": 10,
                    "velocidad_m_s": 5,
                    "rumbo_grados": 90,
                    "capturada_en": (captured + timedelta(seconds=index * 20)).isoformat(),
                } for index in range(2)]
                response = await client.post(
                    f"/entregas/{data['delivery_id']}/ubicaciones/sincronizar",
                    headers={"Authorization": f"Bearer {driver_token}"},
                    json={"puntos": points},
                )
                response.raise_for_status()
                batch_result = response.json()
                assert batch_result["guardados"] == 2
                assert batch_result["distancia_recorrida_m"] > 10
                update = json.loads(await asyncio.wait_for(socket.recv(), timeout=5))
                assert update["tipo"] == "ubicaciones"
                assert len(update["puntos"]) == 2
                assert update["puntos"][0]["registrada_en"].endswith(("Z", "+00:00"))
                assert update["distancia_recorrida_m"] == batch_result["distancia_recorrida_m"]
                print("LIVE_REALTIME_OK snapshot + 2 puntos + distancia incremental")
    finally:
        cleanup(data)


if __name__ == "__main__":
    asyncio.run(run())
