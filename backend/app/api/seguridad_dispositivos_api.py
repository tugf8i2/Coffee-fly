"""Inventory and remote revocation of active company sessions."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_registrador
from app.core.database import get_db
from app.models.auth_session_models import AuthSession
from app.models.usuario_models import Usuario


router = APIRouter(prefix="/seguridad")


def as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


@router.get("/dispositivos")
def list_active_devices(
    _admin: Usuario = Depends(require_registrador),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    sessions = (
        db.query(AuthSession)
        .options(joinedload(AuthSession.user).joinedload(Usuario.rol))
        .filter(AuthSession.expires_at > now)
        .order_by(AuthSession.last_seen_at.desc())
        .all()
    )
    return [{
        "session_id": session.token,
        "device_id": session.device_id,
        "device_name": session.device_name or "Dispositivo sin identificar",
        "device_platform": session.device_platform,
        "user_agent": session.user_agent,
        "signed_in_at": session.signed_in_at,
        "last_seen_at": session.last_seen_at,
        "online": bool(as_utc(session.last_seen_at) and as_utc(session.last_seen_at) >= now - timedelta(seconds=90)),
        "user_id": session.user_id,
        "user_name": " ".join(filter(None, [session.user.nombre_usuario, session.user.apellido])),
        "email": session.user.correo_usuario,
        "role": session.user.rol.descripcion_rol.lower() if session.user.rol else None,
    } for session in sessions if session.user and session.user.eliminado_en is None]


@router.delete("/sesiones/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device_session(
    session_id: str,
    _admin: Usuario = Depends(require_registrador),
    db: Session = Depends(get_db),
):
    session = db.query(AuthSession).filter(AuthSession.token == session_id).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La sesión ya no está activa")
    db.delete(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
