import unittest
from types import SimpleNamespace
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.cooperativa_schemas import CooperativaCreate, CooperativaResponse


class CooperativeSchemaTests(unittest.TestCase):
    def test_create_validates_contact_and_coordinates(self):
        cooperative = CooperativaCreate.model_validate({
            "nombre": "Café del Sur",
            "telefono": "3001234567",
            "correo": "contacto@cafedelsur.co",
            "ubicacion": {
                "x": -76.0507,
                "y": 1.8537,
                "departamento": "Huila",
                "ciudad": "Pitalito",
                "direccion": "Vereda El Cafetal",
            },
        })

        self.assertEqual(cooperative.telefono, "3001234567")
        self.assertEqual(cooperative.ubicacion.y, 1.8537)

    def test_create_rejects_invalid_phone_and_coordinates(self):
        with self.assertRaises(ValidationError):
            CooperativaCreate.model_validate({
                "nombre": "Café del Sur",
                "telefono": "teléfono",
                "correo": "contacto@cafedelsur.co",
                "ubicacion": {
                    "x": -200,
                    "y": 95,
                    "departamento": "Huila",
                    "ciudad": "Pitalito",
                    "direccion": "Vereda El Cafetal",
                },
            })

    def test_response_contains_the_cooperative_location(self):
        location_id = uuid4()
        location = SimpleNamespace(
            id_ubicacion=location_id,
            x=-76.0507,
            y=1.8537,
            departamento="Huila",
            ciudad="Pitalito",
            direccion="Vereda El Cafetal",
        )
        cooperative = SimpleNamespace(
            id_cooperativa=4,
            nombre="Café del Sur",
            telefono="3001234567",
            correo="contacto@cafedelsur.co",
            ubicacion_id=location_id,
            ubicacion=location,
        )

        serialized = CooperativaResponse.model_validate(cooperative).model_dump()

        self.assertEqual(serialized["ubicacion"]["ciudad"], "Pitalito")
        self.assertEqual(serialized["ubicacion_id"], location_id)


if __name__ == "__main__":
    unittest.main()
