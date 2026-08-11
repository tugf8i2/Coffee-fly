from passlib.context import CryptContext

# 🔐 Configuración de hashing (Argon2 recomendado)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

# -------------------------
# HASH PASSWORD
# -------------------------
def hash_password(password: str) -> str:
    """
    Convierte una contraseña en hash seguro usando Argon2.
    """
    return pwd_context.hash(password)


# -------------------------
# VERIFY PASSWORD
# -------------------------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con su hash.
    """
    return pwd_context.verify(plain_password, hashed_password)