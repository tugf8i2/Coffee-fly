from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.core.auth import create_session
from app.core.security import hash_password, password_hash_needs_upgrade, verify_password
from app.models.auth_session_models import AuthSession
from app.repositories.login_repositories import login_get_user_by_email

MAX_FAILED_ATTEMPTS = 3
LOCK_MINUTES = 15


def _as_utc(value):
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def get_account_state(user):
    blocked_until = _as_utc(user.bloqueado_hasta)
    return {
        "failed": int(user.intentos_fallidos or 0),
        "blocked_until": blocked_until,
        "disabled": not bool(user.habilitado),
    }


def set_account_disabled(db, user, disabled: bool):
    user.habilitado = not disabled
    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    if disabled:
        db.query(AuthSession).filter(AuthSession.user_id == user.id_usuario).delete(synchronize_session=False)
    db.commit()
    db.refresh(user)
    return get_account_state(user)


def login_user(db, data):
    user = login_get_user_by_email(db, data.email)
    # La respuesta deliberadamente no revela si el correo existe.
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    now = datetime.now(timezone.utc)
    blocked_until = _as_utc(user.bloqueado_hasta)
    if not user.habilitado:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Este perfil está deshabilitado por el Registrador.")
    if blocked_until and blocked_until > now:
        remaining = max(1, int((blocked_until - now).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Perfil bloqueado temporalmente. Intenta de nuevo en {remaining} minuto(s).",
        )
    if blocked_until and blocked_until <= now:
        user.bloqueado_hasta = None
        user.intentos_fallidos = 0

    if not verify_password(data.password, user.contrasena):
        user.intentos_fallidos = int(user.intentos_fallidos or 0) + 1
        remaining_attempts = MAX_FAILED_ATTEMPTS - user.intentos_fallidos
        if remaining_attempts <= 0:
            user.bloqueado_hasta = now + timedelta(minutes=LOCK_MINUTES)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Credenciales inválidas. Perfil restringido por {LOCK_MINUTES} minutos.",
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Credenciales inválidas. Quedan {remaining_attempts} intento(s) antes del bloqueo temporal.",
        )

    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    if password_hash_needs_upgrade(user.contrasena):
        user.contrasena = hash_password(data.password)
    access_token = create_session(user, db)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id_usuario,
            "nombre": user.nombre_usuario,
            "apellido": user.apellido,
            "correo": user.correo_usuario,
            "rol": user.rol.descripcion_rol.lower(),
        },
    }
