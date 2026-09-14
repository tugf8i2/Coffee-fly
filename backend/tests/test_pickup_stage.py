import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.services.entrega_services import EntregaService


class FakeDb:
    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.committed = True

    def refresh(self, _value):
        pass


class FakePickupRepository:
    def __init__(self, distance_in_degrees=0.0005):
        self.db = FakeDb()
        self.delivery_id = uuid4()
        self.driver_id = 9
        location = SimpleNamespace(x=-74.0721, y=4.711, direccion="Centro", ciudad="Bogotá", departamento="Cundinamarca")
        cooperative = SimpleNamespace(id_cooperativa=2, nombre="Cooperativa Central", ubicacion=location)
        self.load = SimpleNamespace(id_carga=uuid4(), cooperativa=cooperative)
        self.request = SimpleNamespace(carga=self.load)
        self.farmer = SimpleNamespace(latitud_finca=4.711, longitud_finca=-74.0721)
        self.delivery = SimpleNamespace(
            id_entrega=self.delivery_id,
            solicitud_id=uuid4(),
            estado_entrega="en camino",
            carga_recogida_en=None,
            caficultor=self.farmer,
            viaje_id=None,
            finca_latitud_snapshot=4.711,
            finca_longitud_snapshot=-74.0721,
            finca_direccion_snapshot="Centro",
            finca_ubicacion_snapshot_en=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        self.last = SimpleNamespace(
            latitud=4.711 + distance_in_degrees,
            longitud=-74.0721,
            precision_m=10,
            registrada_en=datetime.now(timezone.utc).replace(tzinfo=None),
        )

    def get_entrega_asignada_a_conductor(self, _delivery_id, _driver_id, for_update=False):
        return self.delivery

    def get_solicitud(self, _request_id):
        return self.request

    def get_ultimo_punto_ruta(self, _delivery_id):
        return self.last


class PickupStageTests(unittest.TestCase):
    def service(self, distance_in_degrees=0.0005):
        repository = FakePickupRepository(distance_in_degrees)
        service = EntregaService.__new__(EntregaService)
        service.repository = repository
        return service, repository

    def test_confirms_pickup_near_the_farmer(self):
        service, repository = self.service()

        result = service.confirmar_carga_recogida(
            repository.delivery_id, 5, repository.driver_id
        )

        self.assertEqual(result["etapa_viaje"], "hacia_cooperativa")
        self.assertIsNotNone(repository.delivery.carga_recogida_en)
        self.assertTrue(repository.db.committed)

    def test_rejects_pickup_far_from_the_farmer(self):
        service, repository = self.service(distance_in_degrees=0.01)

        with self.assertRaises(HTTPException) as context:
            service.confirmar_carga_recogida(
                repository.delivery_id, 5, repository.driver_id
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIsNone(repository.delivery.carga_recogida_en)

    def test_revalidates_accuracy_when_confirming_pickup(self):
        service, repository = self.service()
        repository.last.precision_m = 151

        with self.assertRaises(HTTPException) as context:
            service.confirmar_carga_recogida(
                repository.delivery_id, 5, repository.driver_id
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIsNone(repository.delivery.carga_recogida_en)

    def test_uses_frozen_farm_location_instead_of_current_profile(self):
        service, repository = self.service()
        repository.delivery.caficultor.latitud_finca = 5.5
        repository.delivery.caficultor.longitud_finca = -75.5

        result = service.confirmar_carga_recogida(
            repository.delivery_id, 5, repository.driver_id
        )

        self.assertEqual(result["etapa_viaje"], "hacia_cooperativa")

    def test_recovers_missing_legacy_farm_snapshot_once(self):
        service, repository = self.service()
        repository.delivery.finca_latitud_snapshot = None
        repository.delivery.finca_longitud_snapshot = None

        service.confirmar_carga_recogida(
            repository.delivery_id, 5, repository.driver_id
        )
        recovered = (
            repository.delivery.finca_latitud_snapshot,
            repository.delivery.finca_longitud_snapshot,
        )
        repository.delivery.caficultor.latitud_finca = 6.0
        repository.delivery.caficultor.longitud_finca = -76.0
        EntregaService._guardar_snapshot_finca(
            repository.delivery, repository.delivery.caficultor
        )

        self.assertEqual(recovered, (4.711, -74.0721))
        self.assertEqual(
            recovered,
            (repository.delivery.finca_latitud_snapshot, repository.delivery.finca_longitud_snapshot),
        )

    def test_rejects_future_gps_outside_clock_tolerance(self):
        service, repository = self.service()
        repository.last.registrada_en = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=31)

        with self.assertRaises(HTTPException) as context:
            service.confirmar_carga_recogida(
                repository.delivery_id, 5, repository.driver_id
            )

        self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
