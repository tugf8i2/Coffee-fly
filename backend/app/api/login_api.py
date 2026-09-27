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
    conductor = user.conductor
    return {
        "id": user.id_usuario,
        "nombre": user.nombre_usuario,
        "apellido": user.apellido,
        "foto_perfil": user.foto_perfil if user.rol.descripcion_rol.lower() == "conductor" else None,
        "correo": user.correo_usuario,
        "telefono": user.telefono_usuario,
        "tipo_documento": user.tipo_documento,
        "numero_documento": user.numero_documento,
        "rol": user.rol.descripcion_rol.lower(),
        "licencia": conductor.licencia if conductor else None,
        "numero_licencia": conductor.numero_licencia if conductor else None,
        "fecha_expedicion_licencia": conductor.fecha_expedicion_licencia if conductor else None,
        "fecha_vencimiento_licencia": conductor.fecha_vencimiento_licencia if conductor else None,
        "estado_licencia": conductor.estado_licencia if conductor else None,
        "foto_licencia": conductor.foto_licencia if conductor else None,
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    token: str = Depends(get_current_token),
    db: Session = Depends(get_db),
):
    revoke_session(token, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
