import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.entrega_schemas import RegistrarUbicacionRequest, SincronizarUbicacionesRequest
from app.services.entrega_services import EntregaService, _distancia_metros


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
        self.delivery = SimpleNamespace(
            id_entrega=self.delivery_id,
            estado_entrega="en camino",
            distancia_recorrida_m=0,
        )

    def get_vehiculo_entrega(self, _delivery_id, for_update=False):
        self.delivery_locked = for_update
        return (
            self.delivery,
            SimpleNamespace(id_vehiculo=3, conductor_id=self.driver_id),
        )

    def get_ubicacion_por_client_point_id(self, _client_point_id):
        return self.existing

    def get_puntos_vecinos(self, _delivery_id, _captured_at):
        return self.neighbors

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

    def test_adds_real_segment_to_travelled_distance(self):
        captured_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.repository.neighbors = (
            SimpleNamespace(
                latitud=4.711,
                longitud=-74.0721,
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
        self.assertAlmostEqual(result["distancia_recorrida_m"], 111.2, delta=0.5)
        self.assertAlmostEqual(self.repository.delivery.distancia_recorrida_m, 111.2, delta=0.5)

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
