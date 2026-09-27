import unittest
from datetime import datetime
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.inspeccion_vehiculo_schemas import InspeccionVehiculoCreate


def items():
    return [
        {"codigo": code, "estado": "bien", "observacion": "", "foto_evidencia": None}
        for code in ("aceite", "llantas", "frenos", "luces", "documentos", "seguridad")
    ]


class VehicleInspectionSchemaTests(unittest.TestCase):
    def test_accepts_complete_inspection(self):
        value = InspeccionVehiculoCreate(
            client_inspection_id=uuid4(), vehiculo_id=3, viaje_id=uuid4(),
            capturada_en=datetime.now(), items=items(),
        )
        self.assertEqual(len(value.items), 6)

    def test_requires_note_or_photo_for_issue(self):
        values = items()
        values[1]["estado"] = "novedad"
        with self.assertRaises(ValidationError):
            InspeccionVehiculoCreate(
                client_inspection_id=uuid4(), vehiculo_id=3, viaje_id=uuid4(),
                capturada_en=datetime.now(), items=values,
            )

    def test_rejects_missing_check(self):
        with self.assertRaises(ValidationError):
            InspeccionVehiculoCreate(
                client_inspection_id=uuid4(), vehiculo_id=3, viaje_id=uuid4(),
                capturada_en=datetime.now(), items=items()[:-1],
            )


if __name__ == "__main__":
    unittest.main()
