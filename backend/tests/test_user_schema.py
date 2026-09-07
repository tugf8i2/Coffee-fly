import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.schemas.usuario_schemas import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from pydantic import ValidationError


class UserListSchemaTests(unittest.TestCase):
    def test_password_rules_apply_to_create_and_update(self):
        base = dict(nombre_usuario="Ana", apellido="Cafe", correo_usuario="ana@coffeefly.com", telefono_usuario="3001234567", rol_id=3)
        for schema, fields in [(UsuarioCreate, base), (UsuarioUpdate, {})]:
            for password in [None, "", "Abcdef", "abcdefg", "ABCDEFG", "1234567", "Aa" + "x" * 19]:
                with self.subTest(schema=schema.__name__, password=password), self.assertRaises(ValidationError):
                    schema(**fields, contrasena=password)
            for password in ["Abcdefg", "Admin123", "Árboles", "Aa" + "x" * 18]:
                self.assertEqual(schema(**fields, contrasena=password).contrasena, password)

    def test_edit_without_password_preserves_existing_password(self):
        self.assertNotIn("contrasena", UsuarioUpdate(nombre_usuario="Ana").model_dump(exclude_unset=True))

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
