import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.models.auth_session_models import AuthSession
from app.models.conductor_models import Conductor
from app.models.entrega_models import Entrega
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo
from app.models.viaje_models import Viaje
from app.services.usuario_services import UsuarioService


class UserRetirementTests(unittest.TestCase):
    def service(self, role, results=None):
        results = results or {}
        user = SimpleNamespace(id_usuario=7, rol_id=role, habilitado=True, eliminado_en=None)
        db = MagicMock()

        def query(model):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.with_for_update.return_value = chain
            chain.first.return_value = results.get(model, user if model is Usuario else None)
            return chain

        db.query.side_effect = query
        service = UsuarioService.__new__(UsuarioService)
        service.repository = SimpleNamespace(db=db)
        return service, db, user

    def test_caficultor_con_solicitud_pendiente_no_se_elimina(self):
        service, db, _ = self.service(4, {Solicitud.estado_solicitud: ("pendiente",)})
        with self.assertRaises(HTTPException) as error:
            service.eliminar_usuario(7, 9)
        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("solicitud o carga pendiente", error.exception.detail)
        db.commit.assert_not_called()

    def test_caficultor_con_entrega_en_camino_no_se_elimina(self):
        service, db, _ = self.service(4, {Entrega.estado_entrega: ("en camino",)})
        with self.assertRaises(HTTPException) as error:
            service.eliminar_usuario(7, 9)
        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("carga en camino", error.exception.detail)
        db.commit.assert_not_called()

    def test_conductor_con_viaje_asignado_no_se_elimina(self):
        conductor = SimpleNamespace(id_conductor=4, estado_conductor="disponible")
        service, db, _ = self.service(2, {Conductor: conductor, Viaje.estado_viaje: ("asignado",)})
        with self.assertRaises(HTTPException) as error:
            service.eliminar_usuario(7, 9)
        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("viaje o carga asignada", error.exception.detail)
        db.commit.assert_not_called()

    def test_conductor_con_vehiculo_en_camino_no_se_elimina(self):
        conductor = SimpleNamespace(id_conductor=4, estado_conductor="disponible")
        service, db, _ = self.service(2, {Conductor: conductor, Vehiculo.id_vehiculo: (3,)})
        with self.assertRaises(HTTPException) as error:
            service.eliminar_usuario(7, 9)
        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("vehículo en camino", error.exception.detail)
        db.commit.assert_not_called()

    def test_coordinador_con_viaje_activo_no_se_elimina(self):
        service, db, _ = self.service(1, {Viaje.estado_viaje: ("en_camino",)})
        with self.assertRaises(HTTPException) as error:
            service.eliminar_usuario(7, 9)
        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("viaje o carga activa", error.exception.detail)
        db.commit.assert_not_called()

    @patch("app.services.usuario_services.hash_password", return_value="hash-aleatorio")
    def test_perfil_sin_trabajo_activo_se_retira_sin_borrar_historial(self, _hash):
        service, db, user = self.service(3)
        result = service.eliminar_usuario(7, 9)
        self.assertIn("Perfil eliminado", result["mensaje"])
        self.assertFalse(user.habilitado)
        self.assertIsNotNone(user.eliminado_en)
        self.assertEqual(user.correo_usuario, "b7@coffeefly.com")
        self.assertEqual(user.contrasena, "hash-aleatorio")
        db.query.assert_any_call(AuthSession)
        db.delete.assert_not_called()
        db.commit.assert_called_once()

    def test_registrador_no_puede_eliminar_su_propia_sesion(self):
        service, db, _ = self.service(3)
        with self.assertRaises(HTTPException) as error:
            service.eliminar_usuario(7, 7)
        self.assertEqual(error.exception.status_code, 409)
        db.commit.assert_not_called()
