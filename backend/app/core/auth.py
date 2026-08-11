from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.usuario_models import Usuario
from app.models.auth_session_models import AuthSession

_bearer = HTTPBearer(auto_error=False)


def create_session(user: Usuario, db: Session) -> str:
    token = str(uuid4())
    db.add(AuthSession(token=token, user_id=user.id_usuario, expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
    db.commit()
    return token


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticación requerida")
    session = db.query(AuthSession).filter(AuthSession.token == credentials.credentials).first()
    if session is None or session.expires_at <= datetime.now(timezone.utc):
        if session is not None:
            db.delete(session)
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión expirada")
    user = db.query(Usuario).filter(Usuario.id_usuario == session.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    session.expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.commit()
    return user


def require_registrador(user: Usuario = Depends(get_current_user)) -> Usuario:
    if not user.rol or user.rol.descripcion_rol.lower() != "registrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el Registrador puede administrar usuarios")
    return user


def require_roles(*roles: str):
    allowed = {role.lower() for role in roles}

    def validator(user: Usuario = Depends(get_current_user)) -> Usuario:
        current_role = user.rol.descripcion_rol.lower() if user.rol else ""
        if current_role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para esta acción")
        return user

    return validator
