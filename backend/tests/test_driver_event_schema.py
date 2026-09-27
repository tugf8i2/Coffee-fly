import unittest
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.entrega_schemas import ReportarEventoConductorRequest


class DriverEventSchemaTests(unittest.TestCase):
    def test_accepts_supported_event(self):
        report = ReportarEventoConductorRequest(
            tipo_evento="daño vehicular",
            detalle="Llanta pinchada",
        )
        self.assertEqual(report.detalle, "Llanta pinchada")

    def test_accepts_offline_idempotency_metadata(self):
        client_event_id = uuid4()
        captured_at = datetime.now(timezone.utc)
        report = ReportarEventoConductorRequest(
            tipo_evento="retraso",
            client_event_id=client_event_id,
            capturada_en=captured_at,
        )
        self.assertEqual(report.client_event_id, client_event_id)
        self.assertEqual(report.capturada_en, captured_at)

    def test_accepts_operational_milestones(self):
        for event_type in ("inicio del viaje", "retraso", "llegada", "inconveniente", "entrega realizada"):
            with self.subTest(event_type=event_type):
                report = ReportarEventoConductorRequest(tipo_evento=event_type)
                self.assertEqual(report.tipo_evento, event_type)

    def test_rejects_unknown_event(self):
        with self.assertRaises(ValidationError):
            ReportarEventoConductorRequest(tipo_evento="otro")


if __name__ == "__main__":
    unittest.main()
