import unittest

from pydantic import ValidationError

from app.schemas.entrega_schemas import ReportarEventoConductorRequest


class DriverEventSchemaTests(unittest.TestCase):
    def test_accepts_supported_event(self):
        report = ReportarEventoConductorRequest(
            tipo_evento="daño vehicular",
            detalle="Llanta pinchada",
        )
        self.assertEqual(report.detalle, "Llanta pinchada")

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
