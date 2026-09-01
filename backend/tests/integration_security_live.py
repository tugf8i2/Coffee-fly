"""Prueba manual de seguridad contra la API y PostgreSQL locales en ejecución."""
from datetime import datetime, timezone
from uuid import uuid4

import httpx

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth_session_models import AuthSession
from app.models.carga_models import Carga
from app.models.rol_models import Rol
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario

BASE_URL = "http://127.0.0.1:8000"


def main():
    suffix = uuid4().hex[:7]
    db = SessionLocal()
    user_ids = []
    carga_id = None
    solicitud_id = None
    try:
        role = db.query(Rol).filter(Rol.descripcion_rol.ilike("caficultor")).first()
        assert role is not None, "Falta el rol caficultor"
        registrador_role = db.query(Rol).filter(Rol.descripcion_rol.ilike("registrador")).first()
        assert registrador_role is not None, "Falta el rol registrador"
        users = []
        for index in (1, 2):
            user = Usuario(
                nombre_usuario=f"Sec{index}",
                apellido="Temporal",
                correo_usuario=f"s{index}{suffix}@coffeefly.com",
                telefono_usuario=f"30000{suffix[:5]}",
                contrasena=hash_password("ClaveSegura123"),
                departamento="Caldas",
                municipio="Manizales",
                vereda="Prueba",
                rol_id=role.id_rol,
            )
            db.add(user)
            db.flush()
            users.append(user)
            user_ids.append(user.id_usuario)
        registrador = Usuario(
            nombre_usuario="RegSec",
            apellido="Temporal",
            correo_usuario=f"r{suffix}@coffeefly.com",
            telefono_usuario=f"30100{suffix[:5]}",
            contrasena=hash_password("ClaveSegura123"),
            rol_id=registrador_role.id_rol,
        )
        db.add(registrador)
        db.flush()
        user_ids.append(registrador.id_usuario)
        db.commit()

        with httpx.Client(base_url=BASE_URL, timeout=10) as client:
            tokens = []
            for user in users:
                response = client.post("/login", json={"email": user.correo_usuario, "password": "ClaveSegura123"})
                response.raise_for_status()
                tokens.append(response.json()["access_token"])
            headers_owner = {"Authorization": f"Bearer {tokens[0]}"}
            headers_other = {"Authorization": f"Bearer {tokens[1]}"}

            registrador_login = client.post(
                "/login",
                json={"email": registrador.correo_usuario, "password": "ClaveSegura123"},
            )
            registrador_login.raise_for_status()
            headers_registrador = {
                "Authorization": f"Bearer {registrador_login.json()['access_token']}"
            }
            users_response = client.get("/usuarios/", headers=headers_registrador)
            users_response.raise_for_status()
            listed_user = next(
                row for row in users_response.json()
                if row["id_usuario"] == users[0].id_usuario
            )
            assert {"habilitado", "intentos_fallidos", "bloqueado_hasta"} <= listed_user.keys()
            assert "contrasena" not in listed_user

            client_request_id = str(uuid4())
            solicitud_response = client.post(
                "/solicitudes/sincronizar",
                headers=headers_owner,
                json={
                    "client_request_id": client_request_id,
                    "peso_kg": 125.5,
                    "observacion": "Carga de prueba de autorización",
                    "capturada_en": datetime.now(timezone.utc).isoformat(),
                },
            )
            solicitud_response.raise_for_status()
            first = solicitud_response.json()
            carga_id = first["carga_id"]
            solicitud_id = first["solicitud_id"]
            duplicate_response = client.post(
                "/solicitudes/sincronizar",
                headers=headers_owner,
                json={
                    "client_request_id": client_request_id,
                    "peso_kg": 125.5,
                    "observacion": "Carga de prueba de autorización",
                    "capturada_en": datetime.now(timezone.utc).isoformat(),
                },
            )
            duplicate_response.raise_for_status()
            duplicate = duplicate_response.json()
            assert duplicate["estado"] == "duplicada"
            assert duplicate["solicitud_id"] == solicitud_id
            assert duplicate["carga_id"] == carga_id

            assert client.get(f"/cargas/{carga_id}", headers=headers_owner).status_code == 200
            assert client.get(f"/solicitudes/{solicitud_id}", headers=headers_owner).status_code == 200
            assert client.get(f"/cargas/{carga_id}", headers=headers_other).status_code == 403
            assert client.get(f"/solicitudes/{solicitud_id}", headers=headers_other).status_code == 403
            for protected_path in (
                "/roles/", "/conductores/", "/cooperativas/", "/rutas/",
                "/ubicaciones/", "/historial-eventos/",
            ):
                assert client.get(protected_path).status_code == 401, protected_path

        print(
            "LIVE_SECURITY_OK JWT + rutas protegidas + aislamiento + "
            "solicitud idempotente + listado de usuarios sin N+1 ni contrasena"
        )
    finally:
        db.rollback()
        if user_ids:
            db.query(AuthSession).filter(AuthSession.user_id.in_(user_ids)).delete(synchronize_session=False)
        if solicitud_id:
            db.query(Solicitud).filter(Solicitud.id_solicitud == solicitud_id).delete(synchronize_session=False)
        if carga_id:
            db.query(Carga).filter(Carga.id_carga == carga_id).delete(synchronize_session=False)
        if user_ids:
            db.query(Usuario).filter(Usuario.id_usuario.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()


if __name__ == "__main__":
    main()
