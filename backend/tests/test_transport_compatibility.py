import unittest
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.services.compatibilidad_transporte import (
    capacidad_calculada, evaluar_conductor, evaluar_vehiculo, hoy_colombia,
    licencia_compatible,
)


def vehicle(**changes):
    catalog = SimpleNamespace(activo=True, pbv_maximo_legal_kg=17000,
                              licencia_publico="C2", licencia_particular="B2")
    fields = dict(id_vehiculo=1, capacidad_kg=10700, tara_kg=6300,
                  pbv_homologado_kg=17000, estado_vehiculo="disponible",
                  tipo_servicio="PUBLICO", configuracion_catalogo=catalog,
                  cooperativa_id=None, licencia_minima_requerida="C2",
                  soat_vencimiento=hoy_colombia()+timedelta(days=90),
                  tecnomecanica_vencimiento=hoy_colombia()+timedelta(days=90),
                  seguro_vencimiento=hoy_colombia()+timedelta(days=90))
    fields.update(changes)
    return SimpleNamespace(**fields)


def driver(category="C2", **changes):
    fields = dict(id_conductor=2, licencia=category, numero_licencia="12345",
                  foto_licencia="data:image/png;base64,aa", estado_conductor="disponible",
                  fecha_expedicion_licencia=hoy_colombia()-timedelta(days=100),
                  fecha_vencimiento_licencia=hoy_colombia()+timedelta(days=100),
                  cooperativa_id=None,
                  usuarios=SimpleNamespace(habilitado=True, rol=SimpleNamespace(descripcion_rol="conductor")))
    fields.update(changes)
    return SimpleNamespace(**fields)


class TransportCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.db.query.return_value.filter.return_value.first.return_value = None

    def test_8500_kg_fits_10700_kg(self):
        result = evaluar_vehiculo(self.db, vehicle(), 8500)
        self.assertTrue(result["compatible"])
        self.assertEqual(result["capacidad_restante_kg"], 2200)

    def test_12000_kg_exceeds_10700_kg(self):
        self.assertFalse(evaluar_vehiculo(self.db, vehicle(), 12000)["compatible"])

    def test_c1_cannot_drive_public_rigid(self):
        self.assertFalse(evaluar_conductor(self.db, driver("C1"), vehicle())["compatible"])

    def test_c2_can_drive_public_rigid(self):
        self.assertTrue(evaluar_conductor(self.db, driver("C2"), vehicle())["compatible"])

    def test_c3_can_drive_public_rigid(self):
        self.assertTrue(evaluar_conductor(self.db, driver("C3"), vehicle())["compatible"])

    def test_c2_cannot_drive_public_articulated(self):
        self.assertFalse(evaluar_conductor(self.db, driver("C2"), vehicle(licencia_minima_requerida="C3"))["compatible"])

    def test_c3_can_drive_public_articulated(self):
        self.assertTrue(evaluar_conductor(self.db, driver("C3"), vehicle(licencia_minima_requerida="C3"))["compatible"])

    def test_expired_driver_license_rejected(self):
        self.assertFalse(evaluar_conductor(self.db, driver(fecha_vencimiento_licencia=hoy_colombia()-timedelta(days=1)), vehicle())["compatible"])

    def test_expired_vehicle_document_rejected(self):
        self.assertFalse(evaluar_vehiculo(self.db, vehicle(soat_vencimiento=hoy_colombia()-timedelta(days=1)), 8500)["compatible"])

    def test_vehicle_in_maintenance_rejected(self):
        self.assertFalse(evaluar_vehiculo(self.db, vehicle(estado_vehiculo="en mantenimiento"), 8500)["compatible"])

    def test_driver_in_active_trip_rejected(self):
        self.db.query.return_value.filter.return_value.first.return_value = (1,)
        self.assertFalse(evaluar_conductor(self.db, driver(), vehicle())["compatible"])

    def test_zero_or_negative_weight_rejected(self):
        self.assertFalse(evaluar_vehiculo(self.db, vehicle(), 0)["compatible"])
        self.assertFalse(evaluar_vehiculo(self.db, vehicle(), -5)["compatible"])

    def test_tare_greater_than_limit_rejected(self):
        with self.assertRaises(HTTPException):
            capacidad_calculada(18000, 17000, 17000)

    def test_negative_capacity_rejected(self):
        with self.assertRaises(HTTPException):
            capacidad_calculada(6300, 6000, 17000)

    def test_queue_preserved_for_multiple_loads_and_trips(self):
        self.assertTrue(evaluar_vehiculo(self.db, vehicle(estado_vehiculo="en camino"), 8500)["compatible"])

    def test_explicit_license_hierarchy(self):
        self.assertTrue(licencia_compatible("C3", "B2"))
        self.assertFalse(licencia_compatible("B3", "C1"))


if __name__ == "__main__":
    unittest.main()
