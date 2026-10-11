import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.core.security import hash_password, password_hash_needs_upgrade, verify_password
from app.services.login_services import login_user


class PasswordSecurityTests(unittest.TestCase):
    def test_argon2id_hashes_are_salted_and_verifiable(self):
        first = hash_password("CoffeeFly-Test-123")
        second = hash_password("CoffeeFly-Test-123")
        self.assertTrue(first.startswith("$argon2id$"))
        self.assertNotEqual(first, second)
        self.assertTrue(verify_password("CoffeeFly-Test-123", first))
        self.assertFalse(verify_password("incorrecta", first))
        self.assertFalse(password_hash_needs_upgrade(first))

    def test_malformed_hash_is_rejected_without_crashing(self):
        self.assertFalse(verify_password("password", "no-es-un-hash"))
        self.assertTrue(password_hash_needs_upgrade("no-es-un-hash"))

    def test_login_accepts_accidental_outer_spaces_without_changing_password(self):
        user = SimpleNamespace(
            id_usuario=1, nombre_usuario="Conductor", apellido="Prueba",
            correo_usuario="conductor@coffeefly.com", foto_perfil=None,
            rol=SimpleNamespace(descripcion_rol="conductor"),
            contrasena=hash_password("Admin 123"), habilitado=True,
            intentos_fallidos=0, bloqueado_hasta=None,
        )
        db = Mock()
        with patch("app.services.login_services.login_get_user_by_email", return_value=user), \
             patch("app.services.login_services.create_session", return_value="token"):
            result = login_user(db, SimpleNamespace(email=user.correo_usuario, password="  Admin 123  "))

        self.assertEqual(result["access_token"], "token")
        self.assertEqual(user.intentos_fallidos, 0)
        self.assertTrue(verify_password("Admin 123", user.contrasena))


if __name__ == "__main__":
    unittest.main()
