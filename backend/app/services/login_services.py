from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from app.repositories.login_repositories import login_get_user_by_email
from passlib.hash import argon2
from app.core.auth import create_session

# Estado aislado por usuario: un bloqueo nunca afecta a otros perfiles ni al sistema.
_login_attempts: dict[int, dict[str, object]] = {}
MAX_FAILED_ATTEMPTS = 3
LOCK_MINUTES = 15

def get_account_state(user_id: int):
    state = _login_attempts.setdefault(user_id, {"failed": 0, "blocked_until": None, "disabled": False})
    blocked_until = state.get("blocked_until")
    if blocked_until and blocked_until <= datetime.now(timezone.utc):
        state["blocked_until"] = None
        state["failed"] = 0
    return state

def set_account_disabled(user_id: int, disabled: bool):
    state = get_account_state(user_id)
    state["disabled"] = disabled
    state["failed"] = 0
    state["blocked_until"] = None
    return state


def remove_account_state(user_id: int):
    """Elimina el estado temporal de inicio de sesión de un perfil borrado."""
    _login_attempts.pop(user_id, None)

def login_user(db, data):

    user = login_get_user_by_email(db, data.email)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    now = datetime.now(timezone.utc)
    state = get_account_state(user.id_usuario)
    if state.get("disabled"):
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Este perfil está deshabilitado por el Registrador.")
    blocked_until = state.get("blocked_until")
    if blocked_until and blocked_until > now:
        remaining = max(1, int((blocked_until - now).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Perfil bloqueado temporalmente. Intenta de nuevo en {remaining} minuto(s).",
        )
    if blocked_until and blocked_until <= now:
        state["blocked_until"] = None
        state["failed"] = 0

    if not argon2.verify(data.password, user.contrasena):
        state["failed"] = int(state.get("failed", 0)) + 1
        remaining_attempts = MAX_FAILED_ATTEMPTS - int(state["failed"])
        if remaining_attempts <= 0:
            state["blocked_until"] = now + timedelta(minutes=LOCK_MINUTES)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Contraseña o correo incorrecto. Intento fallido número {MAX_FAILED_ATTEMPTS}. Tu cuenta quedará restringida por {LOCK_MINUTES} minutos.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Contraseña o correo incorrecto. Intento fallido número {state['failed']} de {MAX_FAILED_ATTEMPTS}.",
        )

    # Un acceso correcto limpia únicamente el contador de este usuario.
    state["failed"] = 0
    state["blocked_until"] = None

    return {
        "access_token": create_session(user, db),
        "token_type": "bearer",
        "user": {
            "id": user.id_usuario,
            "nombre": user.nombre_usuario,
            "apellido": user.apellido,
            "correo": user.correo_usuario,
            "rol": user.rol.descripcion_rol.lower()
        }
    }
