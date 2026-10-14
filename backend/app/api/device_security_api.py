"""Inventario de sesiones de equipos corporativos y revocación remota."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_token, get_current_user, require_registrador, _decode_access_token
from app.core.database import get_db
from app.core.security import verify_password
from app.models.auth_session_models import AuthSession
from app.models.usuario_models import Usuario

router = APIRouter(prefix="/security")


class AdminProof(BaseModel):
    password: str


def _verify_admin_password(proof: AdminProof, admin: Usuario) -> None:
    if not verify_password(proof.password, admin.contrasena):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Contraseña de administración incorrecta")


@router.post("/sessions/query")
def list_device_sessions(
    proof: AdminProof,
    admin: Usuario = Depends(require_registrador),
    db: Session = Depends(get_db),
):
    _verify_admin_password(proof, admin)
    now = datetime.now(timezone.utc)
    sessions = db.query(AuthSession).order_by(AuthSession.started_at.desc()).limit(500).all()
    user_ids = {session.user_id for session in sessions}
    users = {user.id_usuario: user for user in db.query(Usuario).filter(Usuario.id_usuario.in_(user_ids)).all()} if user_ids else {}
    return [{
        "id": session.token,
        "device_id": session.device_id,
        "device_name": session.device_name or "Dispositivo sin identificar",
        "platform": session.platform,
        "user_id": session.user_id,
        "user_name": f"{users[session.user_id].nombre_usuario} {users[session.user_id].apellido}" if session.user_id in users else "Cuenta eliminada",
        "role": users[session.user_id].rol.descripcion_rol.lower() if session.user_id in users and users[session.user_id].rol else None,
        "started_at": session.started_at,
        "last_seen_at": session.last_seen_at,
        "expires_at": session.expires_at,
        "revoked_at": session.revoked_at,
        "active": session.revoked_at is None and session.expires_at.replace(tzinfo=session.expires_at.tzinfo or timezone.utc) > now,
    } for session in sessions]


@router.post("/sessions/{session_id}/revoke")
def revoke_device_session(
    session_id: str,
    proof: AdminProof,
    admin: Usuario = Depends(require_registrador),
    db: Session = Depends(get_db),
):
    _verify_admin_password(proof, admin)
    session = db.query(AuthSession).filter(AuthSession.token == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"revoked": True, "session_id": session_id}


@router.post("/heartbeat")
def device_heartbeat(
    token: str = Depends(get_current_token),
    _user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_id = _decode_access_token(token)["jti"]
    session = db.query(AuthSession).filter(AuthSession.token == session_id).first()
    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Sesión revocada")
    session.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "active"}
