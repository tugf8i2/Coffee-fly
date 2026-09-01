from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.schemas.login_schemas import LoginSchema
from app.services.login_services import login_user
from app.core.auth import get_current_token, get_current_user, revoke_session
from app.core.database import get_db
from app.models.usuario_models import Usuario

router = APIRouter()


@router.post("/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):
    return login_user(db, data)


@router.get("/me")
def current_profile(user: Usuario = Depends(get_current_user)):
    return {
        "id": user.id_usuario,
        "nombre": user.nombre_usuario,
        "apellido": user.apellido,
        "correo": user.correo_usuario,
        "rol": user.rol.descripcion_rol.lower(),
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    token: str = Depends(get_current_token),
    db: Session = Depends(get_db),
):
    revoke_session(token, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
