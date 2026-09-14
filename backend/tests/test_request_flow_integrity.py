import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.schemas.solicitud_schemas import SincronizarSolicitudRequest, SolicitudUpdate
from app.services.carga_services import CargaService
from app.services.solicitud_services import SolicitudService


class FakeQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *_args):
        return self

    def first(self):
        return self.result


class QueueDb:
    def __init__(self, query_results):
        self.query_results = list(query_results)
        self.added = []
        self.committed = False

    def query(self, *_args):
        return FakeQuery(self.query_results.pop(0))

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.committed = True


class RequestRepository:
    def __init__(self, request, delivery, assigned_result=None):
        self.request = request
        self.delivery = delivery
        self.db = QueueDb([assigned_result])
        self.lock_calls = []

    def get_solicitud(self, _request_id):
        return self.request

    def get_entrega_solicitud_for_update(self, _request_id):
        self.lock_calls.append("entrega")
        return self.delivery

    def get_solicitud_for_update(self, _request_id):
        self.lock_calls.append("solicitud")
        return self.request

    def update_solicitud(self, _request_id, changes):
        for key, value in changes.model_dump(exclude_unset=True).items():
            setattr(self.request, key, value)
        self.db.commit()
        return self.request


class RequestFlowIntegrityTests(unittest.TestCase):
    def sync_payload(self, **changes):
        data = {
            "client_request_id": uuid4(),
            "peso_bulto_kg": 60,
            "cantidad_bultos": 10,
            "peso_extra_kg": 0,
            "observacion": "Café seco",
            "capturada_en": datetime(2026, 9, 14, 12, 0, tzinfo=timezone.utc),
        }
        data.update(changes)
        return SincronizarSolicitudRequest(**data)

    def user(self):
        return SimpleNamespace(
            id_usuario=4,
            rol=SimpleNamespace(descripcion_rol="caficultor"),
        )

    def test_sync_requires_valid_farm_location(self):
        db = QueueDb([
            None,
            SimpleNamespace(latitud_finca=None, longitud_finca=None),
        ])
        service = SolicitudService.__new__(SolicitudService)
        service.repository = SimpleNamespace(db=db)

        with self.assertRaises(HTTPException) as context:
            service.sincronizar_solicitud(self.sync_payload(), 4)

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(db.added, [])

    def test_idempotency_key_rejects_different_payload_with_same_total(self):
        data = self.sync_payload()
        load = SimpleNamespace(
            peso_kg=600, peso_bulto_kg=60, cantidad_bultos=10,
            peso_extra_kg=0, grupos_bultos=None, descripcion="Café seco",
        )
        existing = SimpleNamespace(
            id_solicitud=uuid4(), carga_id=uuid4(), carga=load,
            caficultor_id=4,
            fecha_hora_solicitud=datetime(2026, 9, 14, 12, 0),
        )
        service = SolicitudService.__new__(SolicitudService)
        service.repository = SimpleNamespace(db=QueueDb([existing]))
        different = self.sync_payload(
            client_request_id=data.client_request_id,
            peso_bulto_kg=50,
            cantidad_bultos=12,
        )

        with self.assertRaises(HTTPException) as context:
            service.sincronizar_solicitud(different, 4)

        self.assertEqual(context.exception.status_code, 409)

    def test_identical_idempotent_retry_returns_original_request(self):
        data = self.sync_payload()
        existing = SimpleNamespace(
            id_solicitud=uuid4(), carga_id=uuid4(), caficultor_id=4,
            fecha_hora_solicitud=datetime(2026, 9, 14, 12, 0),
            carga=SimpleNamespace(
                peso_kg=600, peso_bulto_kg=60, cantidad_bultos=10,
                peso_extra_kg=0, grupos_bultos=None, descripcion="Café seco",
            ),
        )
        service = SolicitudService.__new__(SolicitudService)
        service.repository = SimpleNamespace(db=QueueDb([existing]))

        result = service.sincronizar_solicitud(data, 4)

        self.assertEqual(result["estado"], "duplicada")
        self.assertEqual(result["solicitud_id"], existing.id_solicitud)

    def test_cancels_pending_delivery_without_trip_or_vehicle(self):
        request = SimpleNamespace(
            id_solicitud=uuid4(), caficultor_id=4, estado_solicitud="pendiente",
            carga=SimpleNamespace(vehiculo_id=None),
        )
        delivery = SimpleNamespace(
            id_entrega=uuid4(), viaje_id=None, estado_entrega="pendiente",
            actualizado_en=None,
        )
        repository = RequestRepository(request, delivery)
        service = SolicitudService.__new__(SolicitudService)
        service.repository = repository

        result = service.actualizar_solicitud(
            request.id_solicitud,
            SolicitudUpdate(estado_solicitud="cancelado"),
            self.user(),
        )

        self.assertEqual(result.estado_solicitud, "cancelado")
        self.assertEqual(delivery.estado_entrega, "cancelado")
        self.assertEqual(len(repository.db.added), 1)
        self.assertTrue(repository.db.committed)
        self.assertEqual(repository.lock_calls, ["entrega", "solicitud"])

    def test_blocks_cancellation_when_delivery_has_trip(self):
        request = SimpleNamespace(
            id_solicitud=uuid4(), caficultor_id=4, estado_solicitud="pendiente",
            carga=SimpleNamespace(vehiculo_id=2),
        )
        delivery = SimpleNamespace(
            id_entrega=uuid4(), viaje_id=uuid4(), estado_entrega="pendiente",
        )
        repository = RequestRepository(request, delivery)
        service = SolicitudService.__new__(SolicitudService)
        service.repository = repository

        with self.assertRaises(HTTPException) as context:
            service.actualizar_solicitud(
                request.id_solicitud,
                SolicitudUpdate(estado_solicitud="cancelado"),
                self.user(),
            )

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(delivery.estado_entrega, "pendiente")

    def test_blocks_deleting_request_linked_to_delivery(self):
        request = SimpleNamespace(
            id_solicitud=uuid4(), caficultor_id=4, estado_solicitud="pendiente",
        )
        service = SolicitudService.__new__(SolicitudService)
        service.repository = SimpleNamespace(
            db=QueueDb([SimpleNamespace(id_entrega=uuid4())]),
            get_solicitud=lambda _request_id: request,
        )

        with self.assertRaises(HTTPException) as context:
            service.eliminar_solicitud(request.id_solicitud, self.user())

        self.assertEqual(context.exception.status_code, 409)

    def test_blocks_deleting_load_linked_to_request(self):
        load = SimpleNamespace(id_carga=uuid4(), caficultor_id=4)
        service = CargaService.__new__(CargaService)
        service.repository = SimpleNamespace(
            db=QueueDb([SimpleNamespace(id_solicitud=uuid4())]),
            get_carga=lambda _load_id: load,
        )

        with self.assertRaises(HTTPException) as context:
            service.eliminar_carga(load.id_carga, self.user())

        self.assertEqual(context.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
