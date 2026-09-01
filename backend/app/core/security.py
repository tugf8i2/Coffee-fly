from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError


_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Genera un hash Argon2id con sal aleatoria; nunca almacena texto plano."""
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError, TypeError):
        return False


def password_hash_needs_upgrade(hashed_password: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(hashed_password)
    except (InvalidHashError, TypeError):
        return True
