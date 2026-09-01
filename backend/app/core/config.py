import os
import secrets
import warnings
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


ENVIRONMENT = os.getenv("ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT in {"production", "prod"}


def _integer_setting(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as error:
        raise RuntimeError(f"{name} debe ser un número entero") from error
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} debe estar entre {minimum} y {maximum}")
    return value


JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
if not JWT_SECRET_KEY:
    if IS_PRODUCTION:
        raise RuntimeError("JWT_SECRET_KEY es obligatoria en producción")
    JWT_SECRET_KEY = secrets.token_urlsafe(48)
    warnings.warn(
        "JWT_SECRET_KEY no está configurada; se generó una clave temporal de desarrollo. "
        "Las sesiones vencerán al reiniciar la API.",
        RuntimeWarning,
        stacklevel=2,
    )

JWT_ALGORITHM = "HS256"
JWT_ISSUER = os.getenv("JWT_ISSUER", "coffee-fly").strip()
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "coffee-fly-api").strip()
ACCESS_TOKEN_EXPIRE_MINUTES = _integer_setting(
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    default=720,
    minimum=5,
    maximum=1440,
)
DB_POOL_SIZE = _integer_setting("DB_POOL_SIZE", 10, 1, 100)
DB_MAX_OVERFLOW = _integer_setting("DB_MAX_OVERFLOW", 20, 0, 200)
DB_POOL_TIMEOUT_SECONDS = _integer_setting("DB_POOL_TIMEOUT_SECONDS", 15, 1, 120)
DB_STATEMENT_TIMEOUT_MS = _integer_setting("DB_STATEMENT_TIMEOUT_MS", 15000, 1000, 120000)
DB_CONNECT_TIMEOUT_SECONDS = _integer_setting("DB_CONNECT_TIMEOUT_SECONDS", 5, 1, 60)


def cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "")
    if configured.strip():
        return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    if IS_PRODUCTION:
        raise RuntimeError("CORS_ORIGINS es obligatoria en producción")
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ]


def cors_origin_regex() -> str | None:
    # Los Quick Tunnels cambian de subdominio al reiniciarse y se usan solo
    # para pruebas desde un teléfono físico. Producción exige orígenes exactos.
    if IS_PRODUCTION:
        return None
    return r"https://[a-z0-9-]+\.trycloudflare\.com"


def allowed_hosts() -> list[str]:
    configured = os.getenv("ALLOWED_HOSTS", "").strip()
    if configured:
        return [host.strip() for host in configured.split(",") if host.strip()]
    if IS_PRODUCTION:
        raise RuntimeError("ALLOWED_HOSTS es obligatoria en producción")
    return ["*"]
