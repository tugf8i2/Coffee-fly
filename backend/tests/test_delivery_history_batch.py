import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.services.entrega_services import EntregaService


class FakeHistoryBatchRepository:
    def __init__(self, delivery_ids):
        self.delivery_ids = set(delivery_ids)
        self.batch_calls = 0

    def get_entrega_ids_existentes(self, _ids):
        return set(self.delivery_ids)

    def get_entrega_ids_asignadas_a_conductor(self, _ids, _conductor_id):
        return set(self.delivery_ids)

    def get_historial_estados_lote(self, ids):
        self.batch_calls += 1
        return [(
            SimpleNamespace(
                entrega_id=ids[0],
                id_historial=uuid4(),
                estado_anterior="pendiente",
                estado_nuevo="en camino",
                fecha_hora_cambio=None,
            ),
            SimpleNamespace(id_usuario=7, nombre_usuario="Ana", apellido="Prueba"),
        )]


class DeliveryHistoryBatchTests(unittest.TestCase):
    def test_fetches_histories_in_one_repository_batch(self):
        delivery_ids = [uuid4(), uuid4()]
        repository = FakeHistoryBatchRepository(delivery_ids)
        service = EntregaService.__new__(EntregaService)
        service.repository = repository
        rows = service.obtener_historial_estados_lote(
            delivery_ids,
            SimpleNamespace(conductor=None),
            False,
        )
        self.assertEqual(repository.batch_calls, 1)
        self.assertEqual(rows[0]["entrega_id"], delivery_ids[0])

    def test_rejects_unknown_delivery_before_reading_history(self):
        known = uuid4()
        repository = FakeHistoryBatchRepository([known])
        service = EntregaService.__new__(EntregaService)
        service.repository = repository
        with self.assertRaises(HTTPException) as context:
            service.obtener_historial_estados_lote(
                [known, uuid4()],
                SimpleNamespace(conductor=None),
                False,
            )
        self.assertEqual(context.exception.status_code, 404)
        self.assertEqual(repository.batch_calls, 0)


if __name__ == "__main__":
    unittest.main()
