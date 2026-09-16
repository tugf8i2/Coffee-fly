import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.reportes_api import router, _periodo
from app.core.auth import get_current_user
from app.core.database import get_db


class ReportApiTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.role = 'registrador'
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(rol=SimpleNamespace(descripcion_rol=self.role))
        db = MagicMock()
        db.query.return_value.group_by.return_value.all.return_value = [(1, 2), (2, 3), (3, 1), (4, 10)]
        db.query.return_value.scalar.return_value = 4
        app.dependency_overrides[get_db] = lambda: db
        self.client = TestClient(app)

    def test_registry_download_formats_and_permissions(self):
        for format, signature in [('pdf', b'%PDF'), ('excel', b'PK')]:
            response = self.client.get('/reportes/registros/exportar', params={'formato': format})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.content.startswith(signature))
            self.assertIn('attachment', response.headers['content-disposition'])
        self.assertEqual(self.client.get('/reportes/registros/exportar?formato=csv').status_code, 400)
        self.role = 'conductor'
        self.assertEqual(self.client.get('/reportes/registros/exportar?formato=pdf').status_code, 403)

    def test_operational_exports_and_role_separation(self):
        self.assertEqual(self.client.get('/reportes/exportar?formato=pdf').status_code, 403)
        self.role = 'coordinador'
        data = {'periodo': {'desde': date(2026, 9, 1), 'hasta': date(2026, 9, 16)},
                'cafe_por_caficultor': [], 'entregas_por_vehiculo': [], 'resumen_diario': []}
        with patch('app.api.reportes_api._datos_reporte', return_value=data):
            for format in ['pdf', 'excel']:
                self.assertEqual(self.client.get('/reportes/exportar', params={'formato': format}).status_code, 200)

    def test_thirty_days_inclusive(self):
        start, end = _periodo(date(2026, 9, 1), date(2026, 9, 30))
        self.assertEqual((end - start).days, 30)
        from fastapi import HTTPException
        with self.assertRaises(HTTPException):
            _periodo(date(2026, 9, 1), date(2026, 10, 1))


if __name__ == '__main__':
    unittest.main()
