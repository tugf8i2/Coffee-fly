import unittest
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.viaje_schemas import ViajeAsignarRequest


class TripSchemaTests(unittest.TestCase):
    def test_accepts_multiple_deliveries(self):
        delivery_ids = [uuid4(), uuid4()]
        request = ViajeAsignarRequest(
            entrega_ids=delivery_ids,
            vehiculo_id=1,
            conductor_id=2,
            cooperativa_id=3,
        )

        self.assertEqual(request.entrega_ids, delivery_ids)

    def test_requires_at_least_one_delivery(self):
        with self.assertRaises(ValidationError):
            ViajeAsignarRequest(
                entrega_ids=[],
                vehiculo_id=1,
                conductor_id=2,
                cooperativa_id=3,
            )


if __name__ == "__main__":
    unittest.main()
