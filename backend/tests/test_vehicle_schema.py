import unittest
from datetime import date

from pydantic import ValidationError

from app.schemas.vehiculo_schemas import VehiculoCreate, VehiculoUpdate


def valid_vehicle(**changes):
    data = dict(placa="ABC123", tipo_vehiculo="Camión", modelo="2024",
                marca="Chevrolet", modelo_comercial="NPR", tipo_servicio="PUBLICO",
                configuracion="C2", tara_kg=6300, pbv_homologado_kg=17000,
                soat_vencimiento=date(2028, 1, 1), tecnomecanica_vencimiento=date(2028, 1, 1),
                seguro_vencimiento=date(2028, 1, 1))
    data.update(changes)
    return data


class VehicleSchemaTests(unittest.TestCase):
    def test_accepts_technical_weight_and_model_year(self):
        vehicle = VehiculoCreate(**valid_vehicle())
        self.assertEqual(vehicle.modelo, "2024")
        self.assertEqual(vehicle.tara_kg, 6300)

    def test_rejects_model_year_before_2000(self):
        with self.assertRaises(ValidationError):
            VehiculoCreate(**valid_vehicle(modelo="1999"))

    def test_rejects_non_numeric_model_on_update(self):
        with self.assertRaises(ValidationError):
            VehiculoUpdate(modelo="NPR")

    def test_rejects_frontend_capacity_override(self):
        with self.assertRaises(ValidationError):
            VehiculoCreate(**valid_vehicle(capacidad_kg=17000))

    def test_requires_technical_weight(self):
        data = valid_vehicle()
        del data["tara_kg"]
        with self.assertRaises(ValidationError):
            VehiculoCreate(**data)


if __name__ == "__main__":
    unittest.main()
