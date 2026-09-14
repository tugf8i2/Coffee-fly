import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi import HTTPException

from app.schemas.carga_schemas import CargaUpdate
from app.schemas.solicitud_schemas import SolicitudUpdate
from app.services.carga_services import CargaService
from app.services.entrega_services import EntregaService
from app.services.solicitud_services import SolicitudService


class FakeQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *_args):
        return self

    def first(self):
        return self.result


class FlowIntegrityTests(unittest.TestCase):
    @staticmethod
    def query(first=None, all_results=None):
        query = MagicMock()
        query.filter.return_value = query
        query.order_by.return_value = query
        query.with_for_update.return_value = query
        query.first.return_value = first
        query.all.return_value = all_results or []
        return query

    def test_available_capacity_subtracts_active_load(self):
        vehicle = SimpleNamespace(
            id_vehiculo=1, placa="ABC123", tipo_vehiculo="Camión", modelo=None,
            capacidad_kg=1000, estado_vehiculo="disponible",
        )
        service = EntregaService.__new__(EntregaService)
        service.repository = SimpleNamespace(
            get_vehiculos_disponibles_con_carga=lambda: [(vehicle, 325)]
        )

        result = service.obtener_vehiculos_disponibles()[0]

        self.assertEqual(result["capacidad_disponible_kg"], 675)

    def test_linked_load_cannot_be_edited(self):
        load = SimpleNamespace(caficultor_id=4)
        repository = SimpleNamespace(
            get_carga=lambda _id: load,
            db=SimpleNamespace(query=lambda *_args: FakeQuery((uuid4(),))),
        )
        service = CargaService.__new__(CargaService)
        service.repository = repository
        user = SimpleNamespace(
            id_usuario=4,
            rol=SimpleNamespace(descripcion_rol="caficultor"),
        )

        with self.assertRaises(HTTPException) as context:
            service.actualizar_carga(uuid4(), CargaUpdate(descripcion="nuevo"), user)

        self.assertEqual(context.exception.status_code, 409)

    def test_linked_request_cannot_change_critical_fields(self):
        request = SimpleNamespace(
            id_solicitud=uuid4(), caficultor_id=4, estado_solicitud="pendiente",
            carga=SimpleNamespace(vehiculo_id=2),
        )
        delivery = SimpleNamespace(
            id_entrega=uuid4(), viaje_id=uuid4(), estado_entrega="pendiente",
        )
        repository = SimpleNamespace(
            get_solicitud=lambda _id: request,
            get_entrega_solicitud_for_update=lambda _id: delivery,
            get_solicitud_for_update=lambda _id: request,
            db=SimpleNamespace(query=lambda *_args: FakeQuery(delivery)),
        )
        service = SolicitudService.__new__(SolicitudService)
        service.repository = repository
        user = SimpleNamespace(
            id_usuario=10,
            rol=SimpleNamespace(descripcion_rol="coordinador"),
        )

        with self.assertRaises(HTTPException) as context:
            service.actualizar_solicitud(
                request.id_solicitud,
                SolicitudUpdate(estado_solicitud="cancelado"),
                user,
            )

        self.assertEqual(context.exception.status_code, 409)

    def test_coordinator_cancels_unassigned_collection(self):
        load = SimpleNamespace(vehiculo_id=None, cooperativa_id=None)
        request = SimpleNamespace(estado_solicitud="pendiente", carga=load)
        delivery = SimpleNamespace(
            id_entrega=uuid4(), viaje_id=None, orden_recoleccion=None,
            estado_entrega="pendiente", carga_recogida_en=None,
            actualizado_en=None, solicitud=request,
        )
        db = MagicMock()
        db.query.side_effect = [self.query(first=(None,)), self.query(first=delivery)]
        service = EntregaService.__new__(EntregaService)
        service.repository = SimpleNamespace(db=db)

        result = service.cancelar_recoleccion(delivery.id_entrega, 10)

        self.assertIs(result, delivery)
        self.assertEqual(delivery.estado_entrega, "cancelado")
        self.assertEqual(request.estado_solicitud, "cancelado")
        db.commit.assert_called_once()

    def test_coordinator_cancels_last_collection_and_promotes_queue(self):
        trip_id = uuid4()
        trip = SimpleNamespace(id_viaje=trip_id, vehiculo_id=3, estado_viaje="asignado")
        next_trip = SimpleNamespace(
            id_viaje=uuid4(), estado_viaje="en_cola", orden_cola=6,
            creado_en=SimpleNamespace(),
        )
        load = SimpleNamespace(vehiculo_id=3, cooperativa_id=2)
        request = SimpleNamespace(estado_solicitud="pendiente", carga=load)
        delivery = SimpleNamespace(
            id_entrega=uuid4(), viaje_id=trip_id, orden_recoleccion=1,
            estado_entrega="pendiente", carga_recogida_en=None,
            actualizado_en=None, solicitud=request,
        )
        db = MagicMock()
        db.query.side_effect = [
            self.query(first=(trip_id,)), self.query(first=trip),
            self.query(first=delivery), self.query(all_results=[]),
            self.query(all_results=[next_trip]),
        ]
        service = EntregaService.__new__(EntregaService)
        service.repository = SimpleNamespace(db=db)

        service.cancelar_recoleccion(delivery.id_entrega, 10)

        self.assertEqual(trip.estado_viaje, "cancelado")
        self.assertEqual(next_trip.estado_viaje, "asignado")
        self.assertEqual(next_trip.orden_cola, 1)
        self.assertIsNone(delivery.viaje_id)
        self.assertIsNone(load.vehiculo_id)
        self.assertIsNone(load.cooperativa_id)

    def test_coordinator_cannot_cancel_started_collection(self):
        trip_id = uuid4()
        trip = SimpleNamespace(id_viaje=trip_id, estado_viaje="en_camino")
        delivery = SimpleNamespace(
            id_entrega=uuid4(), viaje_id=trip_id, estado_entrega="pendiente",
            carga_recogida_en=None,
        )
        db = MagicMock()
        db.query.side_effect = [
            self.query(first=(trip_id,)), self.query(first=trip), self.query(first=delivery),
        ]
        service = EntregaService.__new__(EntregaService)
        service.repository = SimpleNamespace(db=db)

        with self.assertRaises(HTTPException) as context:
            service.cancelar_recoleccion(delivery.id_entrega, 10)

        self.assertEqual(context.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
