import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.schemas.usuario_schemas import UsuarioResponse


class UserListSchemaTests(unittest.TestCase):
    def test_user_list_exposes_account_state_without_password(self):
        blocked_until = datetime(2026, 8, 29, 19, 0, tzinfo=timezone.utc)
        user = SimpleNamespace(
            id_usuario=8,
            nombre_usuario="Ana",
            apellido="Café",
            correo_usuario="ana.afe@coffeefly.com",
            telefono_usuario="3001234567",
            rol_id=3,
            departamento=None,
            municipio=None,
            vereda=None,
            licencia=None,
            tiene_foto_licencia=False,
            habilitado=False,
            intentos_fallidos=5,
            bloqueado_hasta=blocked_until,
            contrasena="hash-que-no-debe-salir",
        )

        serialized = UsuarioResponse.model_validate(user).model_dump()

        self.assertFalse(serialized["habilitado"])
        self.assertEqual(serialized["intentos_fallidos"], 5)
        self.assertEqual(serialized["bloqueado_hasta"], blocked_until)
        self.assertNotIn("contrasena", serialized)


if __name__ == "__main__":
    unittest.main()
