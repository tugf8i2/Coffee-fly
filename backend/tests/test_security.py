import unittest

from app.core.security import hash_password, password_hash_needs_upgrade, verify_password


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


if __name__ == "__main__":
    unittest.main()
