import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.realtime import TrackingConnectionManager
from app.main import app


class FakeWebSocket:
    def __init__(self, fails=False):
        self.fails = fails
        self.messages = []

    async def send_json(self, message):
        if self.fails:
            raise RuntimeError("socket closed")
        self.messages.append(message)


class TrackingConnectionManagerTests(unittest.IsolatedAsyncioTestCase):
    async def test_broadcasts_only_to_selected_delivery_and_removes_closed_sockets(self):
        manager = TrackingConnectionManager()
        first_delivery = uuid4()
        second_delivery = uuid4()
        active = FakeWebSocket()
        closed = FakeWebSocket(fails=True)
        other = FakeWebSocket()
        await manager.connect(first_delivery, active)
        await manager.connect(first_delivery, closed)
        await manager.connect(second_delivery, other)

        await manager.broadcast(first_delivery, {"tipo": "ubicacion", "punto": {"latitud": 4.7}})

        self.assertEqual(len(active.messages), 1)
        self.assertEqual(other.messages, [])
        self.assertEqual(await manager.connection_count(), 2)


class RealtimeEndpointTests(unittest.TestCase):
    def test_authenticates_then_sends_snapshot_and_pong(self):
        delivery_id = uuid4()
        snapshot = {
            "entrega_id": delivery_id,
            "estado_entrega": "en camino",
            "vehiculo_id": 1,
            "vehiculo_placa": "ABC123",
            "total_puntos": 0,
            "ruta_truncada": False,
            "puntos": [],
        }
        with patch("app.api.realtime_api.authenticated_snapshot", return_value=snapshot):
            with TestClient(app).websocket_connect("/ws/seguimiento") as socket:
                socket.send_json({
                    "tipo": "autenticar",
                    "token": "test-token",
                    "entrega_id": str(delivery_id),
                })
                self.assertEqual(socket.receive_json()["tipo"], "snapshot")
                socket.send_json({"tipo": "ping"})
                self.assertEqual(socket.receive_json()["tipo"], "pong")


if __name__ == "__main__":
    unittest.main()
