"""Comprueba el flujo real de bultos contra la API local."""
from uuid import uuid4

import httpx

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth_session_models import AuthSession
from app.models.carga_models import Carga
from app.models.rol_models import Rol
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario


def main():
    db = SessionLocal()
    suffix = str(uuid4().int)[:8]
    user = None
    request_id = load_id = None
    try:
        role = db.query(Rol).filter(Rol.descripcion_rol.ilike("caficultor")).first()
        user = Usuario(nombre_usuario="Prueba", apellido="Bultos", correo_usuario=f"bultos{suffix}@coffeefly.com",
                       telefono_usuario=f"31{suffix[:8]}", contrasena=hash_password("ClaveSegura123"),
                       departamento="Huila", municipio="Pitalito", vereda="Prueba", rol_id=role.id_rol)
        db.add(user)
        db.commit()
        db.refresh(user)
        with httpx.Client(base_url="http://127.0.0.1:8000", timeout=10) as client:
            login = client.post("/login", json={"email": user.correo_usuario, "password": "ClaveSegura123"})
            login.raise_for_status()
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
            response = client.post("/solicitudes/sincronizar", headers=headers, json={
                "client_request_id": str(uuid4()),
                "grupos_bultos": [{"peso_bulto_kg": 60, "cantidad_bultos": 12}, {"peso_bulto_kg": 35.5, "cantidad_bultos": 1}],
                "observacion": "Café seco", "capturada_en": "2026-09-07T01:00:00Z",
            })
            response.raise_for_status()
            result = response.json()
            request_id, load_id = result["solicitud_id"], result["carga_id"]
            activity = client.get("/solicitudes/mis-solicitudes", headers=headers)
            activity.raise_for_status()
            item = activity.json()["solicitudes_activas"][0]
            assert item["peso_kg"] == 755.5
            assert len(item["grupos_bultos"]) == 2
            print("LIVE_BAGS_OK 12x60kg + 35.5kg = 0.7555t")
    finally:
        db.rollback()
        if user:
            db.query(AuthSession).filter(AuthSession.user_id == user.id_usuario).delete(synchronize_session=False)
        if request_id:
            db.query(Solicitud).filter(Solicitud.id_solicitud == request_id).delete(synchronize_session=False)
        if load_id:
            db.query(Carga).filter(Carga.id_carga == load_id).delete(synchronize_session=False)
        if user:
            db.query(Usuario).filter(Usuario.id_usuario == user.id_usuario).delete(synchronize_session=False)
        db.commit()
        db.close()


if __name__ == "__main__":
    main()
