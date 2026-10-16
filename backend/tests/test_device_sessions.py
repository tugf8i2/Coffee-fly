from datetime import datetime
import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401 - load model relationships
from app.api.seguridad_dispositivos_api import list_active_devices, revoke_device_session
from app.core.auth import _decode_access_token, create_session, get_user_from_token, touch_session
from app.core.database import Base
from app.models.rol_models import Rol
from app.models.usuario_models import Usuario


def test_device_inventory_and_remote_revocation():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        admin_role = Rol(descripcion_rol="registrador")
        driver_role = Rol(descripcion_rol="conductor")
        admin = Usuario(
            nombre_usuario="Admin", apellido="CoffeeFly", correo_usuario="admin@coffeefly.com",
            telefono_usuario="3000000000", contrasena="hash", rol=admin_role,
        )
        driver = Usuario(
            nombre_usuario="Ana", apellido="Ruta", correo_usuario="ana@coffeefly.com",
            telefono_usuario="3000000001", contrasena="hash", rol=driver_role,
        )
        db.add_all([admin, driver])
        db.commit()

        token = create_session(
            driver, db, device_id="installation-123", device_name="Android de prueba",
            device_platform="Android WebView", user_agent="Coffee Fly test",
        )
        session_id = _decode_access_token(token)["jti"]
        touch_session(token, db)
        devices = list_active_devices(_admin=admin, db=db)
        assert len(devices) == 1
        assert devices[0]["session_id"] == session_id
        assert devices[0]["device_id"] == "installation-123"
        assert devices[0]["role"] == "conductor"
        assert devices[0]["online"] is True
        assert isinstance(devices[0]["last_seen_at"], datetime)

        revoke_device_session(session_id, _admin=admin, db=db)
        assert list_active_devices(_admin=admin, db=db) == []
        with pytest.raises(HTTPException) as revoked:
            get_user_from_token(token, db)
        assert revoked.value.status_code == 401
    engine.dispose()


def test_migration_preserves_existing_sessions():
    path = Path(__file__).resolve().parents[1] / "migrations/versions/20261015_24_device_sessions.py"
    spec = importlib.util.spec_from_file_location("device_sessions_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE auth_session (token VARCHAR(64) PRIMARY KEY, user_id INTEGER, expires_at DATETIME)")
        connection.exec_driver_sql("INSERT INTO auth_session VALUES ('existing', 7, '2026-12-01')")
        operations = Operations(MigrationContext.configure(connection))
        original = migration.op
        migration.op = operations
        try:
            migration.upgrade()
        finally:
            migration.op = original
        row = connection.execute(sa.text("SELECT token, device_id, signed_in_at, last_seen_at FROM auth_session")).one()
        assert row.token == "existing"
        assert row.device_id is None
        assert row.signed_in_at is None
        assert row.last_seen_at is None
    engine.dispose()
