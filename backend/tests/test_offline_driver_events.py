import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

from fastapi import HTTPException

from app.services.entrega_services import EntregaService


class OfflineDriverEventTests(unittest.TestCase):
    def service_for(self, delivery, existing=None):
        repository = SimpleNamespace(
            get_evento_conductor_por_client_id=Mock(return_value=existing),
            crear_evento_conductor=Mock(side_effect=lambda event: event),
        )
        service = EntregaService.__new__(EntregaService)
        service.repository = repository
        service._obtener_carga_asignada = Mock(return_value=(delivery, uuid4()))
        return service, repository

    def test_preserves_capture_time_when_completed_trip_syncs_late(self):
        captured_at = datetime.now() - timedelta(minutes=20)
        delivery = SimpleNamespace(
            estado_entrega="entregado",
            viaje=SimpleNamespace(
                iniciado_en=captured_at - timedelta(hours=1),
                completado_en=captured_at + timedelta(minutes=5),
            ),
        )
        service, repository = self.service_for(delivery)
        client_event_id = uuid4()
        delivery_id = uuid4()

        event = service.reportar_evento_conductor(
            delivery_id,
            "retraso",
            "Derrumbe",
            8,
            3,
            client_event_id,
            captured_at,
        )

        self.assertEqual(event.client_event_id, client_event_id)
        self.assertEqual(event.fecha_hora_evento, captured_at)
        self.assertEqual(event.descripcion_evento, "Retraso: Derrumbe")
        repository.crear_evento_conductor.assert_called_once()

    def test_returns_existing_event_for_idempotent_retry(self):
        delivery_id = uuid4()
        existing = SimpleNamespace(entrega_id=delivery_id)
        delivery = SimpleNamespace(estado_entrega="entregado", viaje=None)
        service, repository = self.service_for(delivery, existing)

        result = service.reportar_evento_conductor(
            delivery_id,
            "retraso",
            None,
            8,
            3,
            uuid4(),
            datetime.now() - timedelta(days=2),
        )

        self.assertIs(result, existing)
        repository.crear_evento_conductor.assert_not_called()

    def test_rejects_late_event_outside_completed_trip_window(self):
        now = datetime.now()
        delivery = SimpleNamespace(
            estado_entrega="entregado",
            viaje=SimpleNamespace(
                iniciado_en=now - timedelta(hours=2),
                completado_en=now - timedelta(hours=1),
            ),
        )
        service, _ = self.service_for(delivery)

        with self.assertRaises(HTTPException) as raised:
            service.reportar_evento_conductor(
                uuid4(), "retraso", None, 8, 3, uuid4(), now - timedelta(minutes=30)
            )

        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
