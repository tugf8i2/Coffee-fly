import unittest

from app.core.database import _postgres_connect_args


class PostgresConnectionOptionsTests(unittest.TestCase):
    def test_omits_startup_options_for_hostless_proxy(self):
        options = _postgres_connect_args(
            "postgresql://postgres:secret@coffee-fly-db.db.hostless.cloud:5432/coffee-fly-db"
        )

        self.assertIn("connect_timeout", options)
        self.assertNotIn("options", options)

    def test_keeps_statement_timeout_for_direct_postgres(self):
        options = _postgres_connect_args(
            "postgresql://postgres:secret@postgres.internal:5432/coffee-fly"
        )

        self.assertIn("connect_timeout", options)
        self.assertIn("statement_timeout", options["options"])


if __name__ == "__main__":
    unittest.main()
