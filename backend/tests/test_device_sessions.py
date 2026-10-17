from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

import pytest
import jwt
import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - load model relationships
from app.api.seguridad_dispositivos_api import list_active_devices, revoke_device_session
from app.api.login_api import router as login_router
from app.api.seguridad_dispositivos_api import router as devices_router
from app.core.auth import _decode_access_token, create_session, get_user_from_token, renew_session, revoke_session, touch_session
from app.core.config import JWT_ALGORITHM, JWT_SECRET_KEY
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.rol_models import Rol
from app.models.auth_session_models import AuthSession
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


def test_active_session_renews_before_expiry_and_remains_revocable():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        driver = Usuario(
            nombre_usuario="Ana", apellido="Ruta", correo_usuario="renew@test.local",
            telefono_usuario="3000000001", contrasena="hash",
            rol=Rol(descripcion_rol="conductor"),
        )
        db.add(driver)
        db.commit()
        original = create_session(driver, db)
        assert renew_session(original, db) is None
        payload = _decode_access_token(original)
        soon = datetime.now(timezone.utc) + timedelta(minutes=30)
        payload["exp"] = soon
        session = db.query(AuthSession).filter_by(token=payload["jti"]).one()
        session.expires_at = soon
        db.commit()
        expiring = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        renewed = renew_session(expiring, db)
        renewed_payload = _decode_access_token(renewed)
        assert renewed_payload["jti"] == payload["jti"]
        assert renewed_payload["exp"] > _decode_access_token(expiring)["exp"]
        assert get_user_from_token(renewed, db).id_usuario == driver.id_usuario
        revoke_session(renewed, db)
        with pytest.raises(HTTPException) as revoked:
            get_user_from_token(renewed, db)
        assert revoked.value.status_code == 401
    engine.dispose()


def test_http_remote_revocation_requires_admin_and_invalidates_driver_token():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        admin_role = Rol(descripcion_rol="registrador")
        driver_role = Rol(descripcion_rol="conductor")
        db.add_all([
            Usuario(nombre_usuario="Admin", apellido="Prueba", correo_usuario="admin@test.local",
                    telefono_usuario="3000000000", contrasena=hash_password("Admin123"), rol=admin_role),
            Usuario(nombre_usuario="Ana", apellido="Ruta", correo_usuario="driver@test.local",
                    telefono_usuario="3000000001", contrasena=hash_password("Admin123"), rol=driver_role),
        ])
        db.commit()

    application = FastAPI()
    application.include_router(login_router)
    application.include_router(devices_router)

    def local_db():
        with Session(engine) as db:
            yield db

    application.dependency_overrides[get_db] = local_db
    with TestClient(application) as client:
        admin = client.post("/login", json={"email": "admin@test.local", "password": "Admin123"})
        driver = client.post("/login", json={
            "email": "driver@test.local", "password": "Admin123",
            "device_id": "android-preview", "device_name": "Teléfono de pruebas", "device_platform": "Android",
        })
        assert admin.status_code == driver.status_code == 200
        admin_headers = {"Authorization": f"Bearer {admin.json()['access_token']}"}
        driver_headers = {"Authorization": f"Bearer {driver.json()['access_token']}"}
        assert client.post("/seguridad/sesion/renovar", headers=driver_headers).json() == {"access_token": None}
        assert client.get("/seguridad/dispositivos", headers=driver_headers).status_code == 403
        sessions = client.get("/seguridad/dispositivos", headers=admin_headers)
        assert sessions.status_code == 200
        target = next(item for item in sessions.json() if item["device_id"] == "android-preview")
        assert target["role"] == "conductor"
        assert client.delete(f"/seguridad/sesiones/{target['session_id']}", headers=driver_headers).status_code == 403
        assert client.delete(f"/seguridad/sesiones/{target['session_id']}", headers=admin_headers).status_code == 204
        assert client.get("/me", headers=driver_headers).status_code == 401
        assert client.post("/seguridad/sesion/latido", headers=driver_headers).status_code == 401
        assert client.post("/seguridad/sesion/renovar", headers=driver_headers).status_code == 401
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
