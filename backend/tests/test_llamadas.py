import asyncio
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.call_connections import CallConnectionManager
from app.core.database import Base
from app.main import app
from app.models.conductor_models import Conductor
from app.models.rol_models import Rol
from app.models.usuario_models import Usuario
from app.models.viaje_models import Viaje
from app.services.llamada_services import authorized_call_peer, call_contacts


class FakeSocket:
    def __init__(self):
        self.messages = []

    async def send_json(self, message):
        self.messages.append(message)


class CallConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_sends_only_to_connected_participant(self):
        manager = CallConnectionManager()
        driver = FakeSocket()
        coordinator = FakeSocket()
        await manager.connect(2, driver)
        await manager.connect(1, coordinator)
        self.assertTrue(await manager.send(2, {"tipo": "invitar"}))
        self.assertEqual(driver.messages, [{"tipo": "invitar"}])
        self.assertEqual(coordinator.messages, [])
        await manager.disconnect(2, driver)
        self.assertFalse(await manager.send(2, {"tipo": "invitar"}))


class CallAuthorizationTests(unittest.TestCase):
    def test_only_assigned_driver_and_coordinator_can_signal(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            coordinator_role = Rol(id_rol=1, descripcion_rol="coordinador")
            driver_role = Rol(id_rol=2, descripcion_rol="conductor")
            db.add_all([coordinator_role, driver_role])
            coordinator = Usuario(id_usuario=1, nombre_usuario="Coord", apellido="Uno", correo_usuario="coord@example.com", telefono_usuario="3000000001", contrasena="x", rol=coordinator_role, habilitado=True)
            driver = Usuario(id_usuario=2, nombre_usuario="Chofer", apellido="Dos", correo_usuario="driver@example.com", telefono_usuario="3000000002", contrasena="x", rol=driver_role, habilitado=True)
            outsider = Usuario(id_usuario=3, nombre_usuario="Otro", apellido="Coord", correo_usuario="other@example.com", telefono_usuario="3000000003", contrasena="x", rol=coordinator_role, habilitado=True)
            db.add_all([coordinator, driver, outsider])
            profile = Conductor(id_conductor=4, usuario_id=2, licencia="L", foto_licencia="foto")
            db.add(profile)
            trip_id = uuid4()
            db.add(Viaje(id_viaje=trip_id, vehiculo_id=1, conductor_id=4, coordinador_id=1, cooperativa_id=1, estado_viaje="en_camino", orden_cola=1, creado_en=datetime.now(timezone.utc)))
            db.commit()
            self.assertEqual(authorized_call_peer(db, coordinator, trip_id), driver.id_usuario)
            self.assertEqual(authorized_call_peer(db, driver, trip_id), coordinator.id_usuario)
            self.assertEqual(call_contacts(db, driver)[0]["usuario_id"], coordinator.id_usuario)
            with self.assertRaises(HTTPException) as denied:
                authorized_call_peer(db, outsider, trip_id)
            self.assertEqual(denied.exception.status_code, 403)
        engine.dispose()


class CallSocketTests(unittest.TestCase):
    def test_relay_includes_authenticated_sender_not_client_claim(self):
        trip_id = uuid4()
        call_id = uuid4()
        with patch("app.api.llamada_api._authenticated_user", return_value=2), patch("app.api.llamada_api._authorized_peer", return_value=1), patch("app.api.llamada_api.call_connections.send", new_callable=lambda: self._fake_send()) as delivered:
            with TestClient(app).websocket_connect("/llamadas/ws") as socket:
                socket.send_json({"token": "test-token"})
                self.assertEqual(socket.receive_json()["tipo"], "listo")
                socket.send_json({"tipo": "invitar", "viaje_id": str(trip_id), "llamada_id": str(call_id), "de_usuario_id": 999, "contenido": {"medio": "audio"}})
                socket.send_json({"tipo": "ping"})
                self.assertEqual(socket.receive_json()["tipo"], "pong")
            recipient, message = delivered.messages[0]
            self.assertEqual(recipient, 1)
            self.assertEqual(message["de_usuario_id"], 2)

    @staticmethod
    def _fake_send():
        class Sender:
            def __init__(self):
                self.messages = []

            async def __call__(self, user_id, message):
                self.messages.append((user_id, message))
                return True

        return Sender()


if __name__ == "__main__":
    unittest.main()
