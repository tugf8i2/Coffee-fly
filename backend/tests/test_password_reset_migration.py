import importlib.util
import unittest
from pathlib import Path

import sqlalchemy as sa

from app.core.security import verify_password


MIGRATION_PATH = Path(__file__).resolve().parents[1] / "migrations/versions/20261014_23_reset_profile_passwords.py"
spec = importlib.util.spec_from_file_location("reset_profile_passwords", MIGRATION_PATH)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class PasswordResetMigrationTests(unittest.TestCase):
    def test_reset_active_profiles_and_revoke_their_sessions(self):
        engine = sa.create_engine("sqlite:///:memory:")
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE usuario (id_usuario INTEGER PRIMARY KEY, "
                "contrasena TEXT, eliminado_en TEXT, intentos_fallidos INTEGER, bloqueado_hasta TEXT)"
            )
            connection.exec_driver_sql("CREATE TABLE auth_session (token TEXT, user_id INTEGER)")
            connection.exec_driver_sql(
                "INSERT INTO usuario VALUES "
                "(1, 'old-admin', NULL, 3, '2026-10-15'), "
                "(2, 'old-driver', NULL, 2, NULL), "
                "(3, 'retired', '2026-10-01', 1, NULL)"
            )
            connection.exec_driver_sql(
                "INSERT INTO auth_session VALUES ('admin-token', 1), "
                "('driver-token', 2), ('retired-token', 3)"
            )
            self.assertEqual(migration.reset_existing_profiles(connection), 2)
            rows = connection.execute(sa.text(
                "SELECT id_usuario, contrasena, intentos_fallidos, bloqueado_hasta "
                "FROM usuario ORDER BY id_usuario"
            )).all()
            self.assertTrue(verify_password("Admin123", rows[0].contrasena))
            self.assertTrue(verify_password("Admin123", rows[1].contrasena))
            self.assertEqual((rows[0].intentos_fallidos, rows[0].bloqueado_hasta), (0, None))
            self.assertEqual((rows[1].intentos_fallidos, rows[1].bloqueado_hasta), (0, None))
            self.assertEqual(rows[2].contrasena, "retired")
            sessions = connection.execute(sa.text("SELECT token FROM auth_session")).scalars().all()
            self.assertEqual(sessions, ["retired-token"])


if __name__ == "__main__":
    unittest.main()
