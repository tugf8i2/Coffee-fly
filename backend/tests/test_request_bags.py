import unittest
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.solicitud_schemas import SincronizarSolicitudRequest


class RequestBagTests(unittest.TestCase):
    def payload(self, **changes):
        data = {"client_request_id": uuid4(), "peso_bulto_kg": 60, "cantidad_bultos": 12,
                "peso_extra_kg": 35.5, "capturada_en": datetime.now(timezone.utc)}
        data.update(changes)
        return data

    def test_calculates_total_from_bags_and_extra(self):
        self.assertEqual(SincronizarSolicitudRequest(**self.payload()).peso_total_kg, 755.5)

    def test_requires_positive_integer_bag_count(self):
        with self.assertRaises(ValidationError):
            SincronizarSolicitudRequest(**self.payload(cantidad_bultos=0))

    def test_accepts_legacy_offline_weight(self):
        data = self.payload(peso_bulto_kg=None, cantidad_bultos=None, peso_kg=125.5)
        self.assertEqual(SincronizarSolicitudRequest(**data).peso_total_kg, 125.5)

    def test_calculates_multiple_bag_groups(self):
        data = self.payload(grupos_bultos=[{"peso_bulto_kg": 60, "cantidad_bultos": 10}, {"peso_bulto_kg": 35, "cantidad_bultos": 2}])
        self.assertEqual(SincronizarSolicitudRequest(**data).peso_total_kg, 670)


if __name__ == "__main__":
    unittest.main()
