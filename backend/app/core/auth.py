from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_AUDIENCE,
    JWT_ISSUER,
    JWT_SECRET_KEY,
)
from app.core.database import get_db
from app.models.auth_session_models import AuthSession
from app.models.usuario_models import Usuario

_bearer = HTTPBearer(auto_error=False)


def create_session(user: Usuario, db: Session) -> str:
    """Crea un JWT firmado y conserva solo su identificador revocable en PostgreSQL."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_id = str(uuid4())
    payload = {
        "sub": str(user.id_usuario),
        "jti": token_id,
        "type": "access",
        "iat": now,
        "nbf": now,
        "exp": expires_at,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }
    db.add(AuthSession(token=token_id, user_id=user.id_usuario, expires_at=expires_at))
    db.commit()
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={"require": ["sub", "jti", "type", "iat", "nbf", "exp"]},
        )
    except InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tipo de sesión inválido")
    return payload


def get_user_from_token(token: str, db: Session) -> Usuario:
    payload = _decode_access_token(token)
    session = db.query(AuthSession).filter(AuthSession.token == payload["jti"]).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión revocada")

    now = datetime.now(timezone.utc)
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión expirada")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identidad de sesión inválida") from error
    if session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inconsistente")

    user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
    if user is None or not user.habilitado:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no disponible")
    return user


def get_current_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación requerida",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


def get_current_user(
    token: str = Depends(get_current_token),
    db: Session = Depends(get_db),
) -> Usuario:
    return get_user_from_token(token, db)


def revoke_session(token: str, db: Session) -> None:
    payload = _decode_access_token(token)
    session = db.query(AuthSession).filter(AuthSession.token == payload["jti"]).first()
    if session is not None:
        db.delete(session)
        db.commit()


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
