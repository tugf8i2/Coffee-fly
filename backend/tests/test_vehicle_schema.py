import unittest

from pydantic import ValidationError

from app.schemas.vehiculo_schemas import VehiculoCreate, VehiculoUpdate


class VehicleModelYearValidationTests(unittest.TestCase):
    def test_accepts_model_year_from_2000_onwards(self):
        vehicle = VehiculoCreate(
            placa="ABC123",
            tipo_vehiculo="Camión",
            modelo="2000",
            capacidad_kg=3000,
        )

        self.assertEqual(vehicle.modelo, "2000")

    def test_rejects_model_year_before_2000(self):
        with self.assertRaises(ValidationError):
            VehiculoCreate(
                placa="ABC123",
                tipo_vehiculo="Camión",
                modelo="1999",
                capacidad_kg=3000,
            )

    def test_rejects_non_numeric_model_on_update(self):
        with self.assertRaises(ValidationError):
            VehiculoUpdate(modelo="NPR")

    def test_rejects_vehicle_type_outside_catalog(self):
        with self.assertRaises(ValidationError):
            VehiculoUpdate(tipo_vehiculo="Camioneta")


if __name__ == "__main__":
    unittest.main()
