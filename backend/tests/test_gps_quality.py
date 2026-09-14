import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.entrega_schemas import RegistrarUbicacionRequest, SincronizarUbicacionesRequest
from app.services.entrega_services import (
    EntregaService,
    _distancia_efectiva_metros,
    _distancia_metros,
    _distancia_trayecto,
)


class FakeTrackingRepository:
    def __init__(self):
        self.delivery_id = uuid4()
        self.driver_id = 7
        self.saved = []
        self.existing = None
        self.neighbors = (None, None)
        self.committed = False
        self.rolled_back = False
        self.delivery_locked = False
        self.calls = []
        self.delivery = SimpleNamespace(
            id_entrega=self.delivery_id,
            estado_entrega="en camino",
            distancia_recorrida_m=0,
            viaje_id=None,
        )

    def get_vehiculo_entrega(self, _delivery_id, for_update=False):
        self.calls.append(("entrega", for_update))
        self.delivery_locked = for_update
        return (
            self.delivery,
            SimpleNamespace(id_vehiculo=3, conductor_id=self.driver_id),
        )

    def get_ubicacion_por_client_point_id(self, _client_point_id):
        return self.existing

    def get_puntos_vecinos(self, _delivery_id, _captured_at):
        return self.neighbors

    def get_puntos_vecinos_viaje(self, _trip_id, _captured_at):
        return self.neighbors

    def bloquear_viaje(self, _trip_id):
        self.calls.append(("viaje", True))
        return self.delivery.viaje

    def registrar_ubicacion(self, location, commit=True):
        location.id_ubicacion = uuid4()
        self.saved.append(location)
        return location

    def confirmar_ubicaciones(self):
        self.committed = True

    def revertir_ubicaciones(self):
        self.rolled_back = True


class GpsQualityTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeTrackingRepository()
        self.service = EntregaService.__new__(EntregaService)
        self.service.repository = self.repository

    def point(self, **changes):
        data = {
            "latitud": 4.711,
            "longitud": -74.0721,
            "precision_m": 12,
            "velocidad_m_s": 8,
            "capturada_en": datetime.now(timezone.utc),
        }
        data.update(changes)
        return RegistrarUbicacionRequest(**data)

    def test_distance_uses_real_world_meters(self):
        self.assertAlmostEqual(_distancia_metros(4.711, -74.0721, 4.712, -74.0721), 111.2, delta=0.5)

    def test_schema_rejects_coordinates_outside_the_earth(self):
        with self.assertRaises(ValidationError):
            self.point(latitud=91)

    def test_schema_requires_accuracy(self):
        with self.assertRaises(ValidationError):
            RegistrarUbicacionRequest(
                latitud=4.711,
                longitud=-74.0721,
                capturada_en=datetime.now(timezone.utc),
            )

    def test_rejects_low_accuracy_point(self):
        with self.assertRaises(HTTPException) as context:
            self.service.registrar_ubicacion(
                self.repository.delivery_id,
                self.point(precision_m=151),
                self.repository.driver_id,
            )
        self.assertEqual(context.exception.status_code, 422)
        self.assertEqual(self.repository.saved, [])

    def test_saves_metadata_for_a_valid_point(self):
        point = self.point()
        result = self.service.registrar_ubicacion(
            self.repository.delivery_id, point, self.repository.driver_id
        )
        self.assertTrue(self.repository.delivery_locked)
        self.assertEqual(result["estado"], "guardado")
        self.assertEqual(len(self.repository.saved), 1)
        self.assertEqual(self.repository.saved[0].client_point_id, point.client_point_id)
        self.assertEqual(self.repository.saved[0].precision_m, 12)
        self.assertIsNone(self.repository.saved[0].viaje_id)
        self.assertEqual(result["registrada_en"].utcoffset(), timedelta(0))

    def test_same_client_identifier_is_idempotent(self):
        point = self.point()
        self.repository.existing = SimpleNamespace(
            entrega_id=self.repository.delivery_id,
            id_ubicacion=uuid4(),
            client_point_id=point.client_point_id,
            registrada_en=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        result = self.service.registrar_ubicacion(
            self.repository.delivery_id, point, self.repository.driver_id
        )
        self.assertEqual(result["estado"], "duplicado")
        self.assertEqual(self.repository.saved, [])

    def test_same_client_identifier_is_idempotent_across_deliveries_of_same_trip(self):
        trip_id = uuid4()
        self.repository.delivery.viaje_id = trip_id
        self.repository.delivery.viaje = SimpleNamespace(
            conductor_id=self.repository.driver_id, estado_viaje="en_camino"
        )
        point = self.point()
        self.service.registrar_ubicacion(
            self.repository.delivery_id, point, self.repository.driver_id
        )
        self.repository.existing = self.repository.saved[0]
        self.repository.delivery_id = uuid4()
        self.repository.delivery.id_entrega = self.repository.delivery_id

        result = self.service.registrar_ubicacion(
            self.repository.delivery_id, point, self.repository.driver_id
        )

        self.assertEqual(result["estado"], "duplicado")
        self.assertEqual(len(self.repository.saved), 1)

    def test_trip_distance_is_shared_instead_of_fragmented_by_delivery(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.delivery.viaje_id = uuid4()
        self.repository.delivery.viaje = SimpleNamespace(
            conductor_id=self.repository.driver_id,
            estado_viaje="en_camino",
            distancia_recorrida_m=40,
        )
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711, longitud=-74.0721, precision_m=5,
                registrada_en=captured_at - timedelta(seconds=60), id_ubicacion=uuid4(),
            ),
            None,
        )

        result = self.service.registrar_ubicacion(
            self.repository.delivery_id,
            self.point(latitud=4.712, precision_m=5, capturada_en=captured_at),
            self.repository.driver_id,
        )

        self.assertGreater(result["distancia_recorrida_m"], 140)
        self.assertEqual(
            result["distancia_recorrida_m"],
            self.repository.delivery.viaje.distancia_recorrida_m,
        )
        self.assertEqual(self.repository.delivery.distancia_recorrida_m, 0)

    def test_serializes_trip_before_delivery_and_uses_neighbor_from_other_delivery(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        trip_id = uuid4()
        self.repository.delivery.viaje_id = trip_id
        self.repository.delivery.viaje = SimpleNamespace(
            conductor_id=self.repository.driver_id, estado_viaje="en_camino"
        )
        self.repository.neighbors = (
            SimpleNamespace(
                entrega_id=uuid4(), latitud=4.711, longitud=-74.0721,
                registrada_en=captured_at - timedelta(seconds=5), id_ubicacion=uuid4(),
            ),
            None,
        )

        with self.assertRaises(HTTPException):
            self.service.registrar_ubicacion(
                self.repository.delivery_id,
                self.point(latitud=4.811, capturada_en=captured_at),
                self.repository.driver_id,
            )

        self.assertEqual(
            self.repository.calls[:3],
            [("entrega", False), ("viaje", True), ("entrega", True)],
        )

    def test_rejects_points_after_trip_is_no_longer_active(self):
        self.repository.delivery.viaje_id = uuid4()
        self.repository.delivery.viaje = SimpleNamespace(
            conductor_id=self.repository.driver_id, estado_viaje="completado"
        )

        with self.assertRaises(HTTPException) as context:
            self.service.registrar_ubicacion(
                self.repository.delivery_id, self.point(), self.repository.driver_id
            )

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(self.repository.saved, [])

    def test_clear_movement_accumulates_distance_after_accuracy_discount(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711,
                longitud=-74.0721,
                precision_m=12,
                registrada_en=captured_at - timedelta(seconds=60),
                id_ubicacion=uuid4(),
            ),
            None,
        )
        result = self.service.registrar_ubicacion(
            self.repository.delivery_id,
            self.point(latitud=4.712, capturada_en=captured_at),
            self.repository.driver_id,
        )
        expected = _distancia_efectiva_metros(4.711, -74.0721, 12, 4.712, -74.0721, 12)
        self.assertGreater(expected, 90)
        self.assertAlmostEqual(result["distancia_recorrida_m"], expected, delta=0.5)
        self.assertAlmostEqual(self.repository.delivery.distancia_recorrida_m, expected, delta=0.5)

    def test_stationary_jitter_inside_combined_accuracy_does_not_accumulate(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        previous = SimpleNamespace(
            latitud=4.711, longitud=-74.0721, precision_m=10,
            registrada_en=captured_at - timedelta(seconds=60), id_ubicacion=uuid4(),
        )
        self.repository.neighbors = (previous, None)

        result = self.service.registrar_ubicacion(
            self.repository.delivery_id,
            self.point(latitud=4.71108, precision_m=10, capturada_en=captured_at),
            self.repository.driver_id,
        )

        self.assertEqual(result["estado"], "guardado")
        self.assertEqual(result["distancia_recorrida_m"], 0)

    def test_close_point_inside_duplicate_window_remains_duplicate(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711, longitud=-74.0721, precision_m=10,
                registrada_en=captured_at - timedelta(seconds=10), id_ubicacion=uuid4(),
            ),
            None,
        )

        result = self.service.registrar_ubicacion(
            self.repository.delivery_id,
            self.point(latitud=4.71102, precision_m=10, capturada_en=captured_at),
            self.repository.driver_id,
        )

        self.assertEqual(result["estado"], "duplicado")
        self.assertEqual(self.repository.saved, [])

    def test_plausible_jump_is_accepted_after_accuracy_discount(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711, longitud=-74.0721, precision_m=50,
                registrada_en=captured_at - timedelta(seconds=5), id_ubicacion=uuid4(),
            ),
            None,
        )

        result = self.service.registrar_ubicacion(
            self.repository.delivery_id,
            self.point(latitud=4.71415, precision_m=50, capturada_en=captured_at),
            self.repository.driver_id,
        )

        self.assertEqual(result["estado"], "guardado")
        self.assertLess(result["distancia_recorrida_m"] / 5, 60)

    def test_trip_recomputation_uses_effective_segments(self):
        points = [
            SimpleNamespace(latitud=4.711, longitud=-74.0721, precision_m=10),
            SimpleNamespace(latitud=4.71108, longitud=-74.0721, precision_m=10),
            SimpleNamespace(latitud=4.71208, longitud=-74.0721, precision_m=5),
        ]

        distance = _distancia_trayecto(points)

        self.assertAlmostEqual(
            distance,
            _distancia_efectiva_metros(4.71108, -74.0721, 10, 4.71208, -74.0721, 5),
            delta=0.01,
        )

    def test_rejects_an_impossible_jump(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711,
                longitud=-74.0721,
                registrada_en=captured_at - timedelta(seconds=5),
                id_ubicacion=uuid4(),
            ),
            None,
        )
        with self.assertRaises(HTTPException) as context:
            self.service.registrar_ubicacion(
                self.repository.delivery_id,
                self.point(latitud=4.811, capturada_en=captured_at),
                self.repository.driver_id,
            )
        self.assertEqual(context.exception.status_code, 422)

    def test_rejects_different_positions_with_identical_timestamp(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711,
                longitud=-74.0721,
                registrada_en=captured_at,
                id_ubicacion=uuid4(),
            ),
            None,
        )
        with self.assertRaises(HTTPException) as context:
            self.service.registrar_ubicacion(
                self.repository.delivery_id,
                self.point(latitud=4.811, capturada_en=captured_at),
                self.repository.driver_id,
            )
        self.assertEqual(context.exception.status_code, 422)

    def test_batch_reports_partial_acceptance(self):
        batch = SincronizarUbicacionesRequest(puntos=[
            self.point(),
            self.point(client_point_id=uuid4(), precision_m=151),
        ])
        result = self.service.sincronizar_ubicaciones(
            self.repository.delivery_id, batch, self.repository.driver_id
        )
        self.assertEqual(result["recibidos"], 2)
        self.assertEqual(result["guardados"], 1)
        self.assertEqual(result["rechazados"], 1)
        self.assertTrue(self.repository.committed)
        self.assertFalse(self.repository.rolled_back)


if __name__ == "__main__":
    unittest.main()
