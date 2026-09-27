import os
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import (
    DB_CONNECT_TIMEOUT_SECONDS,
    DB_MAX_OVERFLOW,
    DB_POOL_SIZE,
    DB_POOL_TIMEOUT_SECONDS,
    DB_STATEMENT_TIMEOUT_MS,
    ENVIRONMENT,
)


def _postgres_connect_args(database_url: str) -> dict[str, object]:
    """Return driver options supported by the selected PostgreSQL endpoint.

    Hostless exposes PostgreSQL through a proxy that rejects libpq's
    ``options`` startup parameter.  Keep the connection timeout there, while
    retaining the server-side statement timeout for direct PostgreSQL hosts.
    """

    connect_args: dict[str, object] = {
        "connect_timeout": DB_CONNECT_TIMEOUT_SECONDS,
    }
    hostname = (urlparse(database_url).hostname or "").lower()
    if not hostname.endswith(".db.hostless.cloud"):
        connect_args["options"] = f"-c statement_timeout={DB_STATEMENT_TIMEOUT_MS}"
    return connect_args


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL es obligatoria. Copia backend/.env.example como backend/.env "
        f"y configura PostgreSQL antes de iniciar la API (entorno: {ENVIRONMENT})."
    )

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://")):
    engine_options.update({
        "pool_size": DB_POOL_SIZE,
        "max_overflow": DB_MAX_OVERFLOW,
        "pool_timeout": DB_POOL_TIMEOUT_SECONDS,
        "pool_recycle": 1800,
        "connect_args": _postgres_connect_args(DATABASE_URL),
    })
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
