import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import HTTPException

from app.api.viaje_api import _perfil_conductor
from app.services.viaje_services import ViajeService
from app.repositories.viaje_repositories import ViajeRepository


class DriverHistoryTests(unittest.TestCase):
    def test_repository_keeps_history_own_and_bounded(self):
        db = Mock()
        query = db.query.return_value
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = []
        self.assertEqual(ViajeRepository(db).get_historial_conductor(8), [])
        driver_filter, state_filter = query.filter.call_args.args
        self.assertEqual(driver_filter.compile().params, {"conductor_id_1": 8})
        self.assertEqual(state_filter.compile().params, {"estado_viaje_1": ["completado", "cancelado"]})
        query.limit.assert_called_once_with(100)

    def test_history_is_filtered_by_authenticated_driver_profile(self):
        repository = Mock()
        repository.get_historial_conductor.return_value = ["own_trip"]
        service = ViajeService.__new__(ViajeService)
        service.repository = repository
        service._respuesta = lambda value: {"id": value}
        self.assertEqual(service.historial_conductor(8), [{"id": "own_trip"}])
        repository.get_historial_conductor.assert_called_once_with(8)

    def test_history_requires_existing_driver_profile(self):
        with self.assertRaises(HTTPException) as raised:
            _perfil_conductor(SimpleNamespace(conductor=None))
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
