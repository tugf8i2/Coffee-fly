import unittest
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.core.time import utc_now_naive
from app.services.viaje_services import ViajeService


class FakeDb:
    def __init__(self):
        self.added = []
        self.committed = False
        self.queue = []

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.committed = True

    def flush(self):
        pass

    def query(self, *_args):
        items = self.queue

        class QueueQuery:
            def filter(self, *_filters): return self
            def order_by(self, *_order): return self
            def with_for_update(self): return self
            def all(self): return items

        return QueueQuery()


class FakeTripRepository:
    def __init__(self):
        self.db = FakeDb()
        self.trip = SimpleNamespace(
            id_viaje=uuid4(), conductor_id=8, vehiculo_id=2, cooperativa_id=4,
            estado_viaje="en_camino", completado_en=None,
            cooperativa_latitud_snapshot=4.711,
            cooperativa_longitud_snapshot=-74.0721,
            cooperativa_direccion_snapshot="Cooperativa congelada",
        )
        request = SimpleNamespace(estado_solicitud="en camino")
        self.delivery = SimpleNamespace(
            id_entrega=uuid4(), estado_entrega="en camino", actualizado_en=None,
            carga_recogida_en=utc_now_naive(), solicitud=request,
        )
        self.location = SimpleNamespace(
            latitud=4.711, longitud=-74.0721, precision_m=10,
            registrada_en=utc_now_naive(),
        )
        self.cooperative = SimpleNamespace(
            ubicacion=SimpleNamespace(y=4.711, x=-74.0721)
        )
        self.vehicle = SimpleNamespace(estado_vehiculo="en camino", conductor_id=8)
        self.driver = SimpleNamespace(estado_conductor="en ruta")

    def get_viaje_for_update(self, _trip_id):
        return self.trip

    def get_cargas_viaje(self, _trip_id):
        return [(self.delivery, SimpleNamespace())]

    def get_ultimo_punto_viaje(self, _trip_id):
        return self.location

    def get_cooperativa(self, _cooperative_id):
        return self.cooperative

    def get_vehiculo(self, _vehicle_id, for_update=False):
        return self.vehicle

    def get_conductor(self, _driver_id, for_update=False):
        return self.driver

    def siguiente_en_cola(self, _vehicle_id):
        return None


class TripCompletionTests(unittest.TestCase):
    def service(self):
        repository = FakeTripRepository()
        service = ViajeService.__new__(ViajeService)
        service.repository = repository
        service._respuesta = lambda trip: {"estado_viaje": trip.estado_viaje}
        return service, repository

    def test_completes_with_recent_precise_gps_inside_cooperative_geofence(self):
        service, repository = self.service()

        result = service.completar(repository.trip.id_viaje, 8, 20)

        self.assertEqual(result["estado_viaje"], "completado")
        self.assertTrue(repository.db.committed)

    def test_completion_renumbers_all_waiting_turns(self):
        service, repository = self.service()
        first = SimpleNamespace(
            id_viaje=uuid4(), estado_viaje="en_cola", orden_cola=4,
            creado_en=utc_now_naive(),
        )
        second = SimpleNamespace(
            id_viaje=uuid4(), estado_viaje="en_cola", orden_cola=7,
            creado_en=utc_now_naive(),
        )
        repository.db.queue = [first, second]

        service.completar(repository.trip.id_viaje, 8, 20)

        self.assertEqual((first.orden_cola, first.estado_viaje), (1, "asignado"))
        self.assertEqual((second.orden_cola, second.estado_viaje), (2, "en_cola"))

    def test_rejects_completion_without_gps(self):
        service, repository = self.service()
        repository.location = None

        with self.assertRaises(HTTPException):
            service.completar(repository.trip.id_viaje, 8, 20)

        self.assertFalse(repository.db.committed)

    def test_rejects_stale_or_imprecise_gps(self):
        for change in (
            {"registrada_en": utc_now_naive() - timedelta(minutes=6)},
            {"precision_m": 151},
        ):
            with self.subTest(change=change):
                service, repository = self.service()
                for key, value in change.items():
                    setattr(repository.location, key, value)
                with self.assertRaises(HTTPException):
                    service.completar(repository.trip.id_viaje, 8, 20)
                self.assertFalse(repository.db.committed)

    def test_rejects_gps_outside_cooperative_geofence(self):
        service, repository = self.service()
        repository.location.latitud = 4.72

        with self.assertRaises(HTTPException):
            service.completar(repository.trip.id_viaje, 8, 20)

        self.assertFalse(repository.db.committed)

    def test_uses_cooperative_snapshot_instead_of_current_location(self):
        service, repository = self.service()
        repository.cooperative.ubicacion.y = 5.5
        repository.cooperative.ubicacion.x = -75.5

        result = service.completar(repository.trip.id_viaje, 8, 20)

        self.assertEqual(result["estado_viaje"], "completado")

    def test_recovers_missing_legacy_cooperative_snapshot_once(self):
        service, repository = self.service()
        repository.trip.cooperativa_latitud_snapshot = None
        repository.trip.cooperativa_longitud_snapshot = None

        result = service.completar(repository.trip.id_viaje, 8, 20)

        self.assertEqual(result["estado_viaje"], "completado")
        self.assertEqual(repository.trip.cooperativa_latitud_snapshot, 4.711)
        self.assertEqual(repository.trip.cooperativa_longitud_snapshot, -74.0721)

    def test_rejects_trip_without_snapshot_or_current_coordinates(self):
        service, repository = self.service()
        repository.trip.cooperativa_latitud_snapshot = None
        repository.trip.cooperativa_longitud_snapshot = None
        repository.cooperative.ubicacion.y = None

        with self.assertRaises(HTTPException) as context:
            service.completar(repository.trip.id_viaje, 8, 20)

        self.assertEqual(context.exception.status_code, 409)

    def test_rejects_future_gps_outside_clock_tolerance(self):
        service, repository = self.service()
        repository.location.registrada_en = utc_now_naive() + timedelta(seconds=31)

        with self.assertRaises(HTTPException) as context:
            service.completar(repository.trip.id_viaje, 8, 20)

        self.assertEqual(context.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
