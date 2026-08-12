from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.usuario_schemas import (
    UsuarioCreate,
    UsuarioUpdate,
    UsuarioResponse
)

from app.services.usuario_services import UsuarioService
from app.core.auth import require_registrador
from app.services.login_services import set_account_disabled, get_account_state


router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"]
)


@router.get(
    "/",
    response_model=list[UsuarioResponse]
)
def listar_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = UsuarioService(db)

    return service.obtener_usuarios(
        skip,
        limit
    )


@router.get(
    "/correo/{correo}",
    response_model=UsuarioResponse
)
def obtener_usuario_por_correo(
    correo: str,
    db: Session = Depends(get_db)
):

    service = UsuarioService(db)

    return service.obtener_usuario_por_correo(
        correo
    )


@router.get(
    "/{id_usuario}",
    response_model=UsuarioResponse
)
def obtener_usuario(
    id_usuario: int,
    db: Session = Depends(get_db)
):

    service = UsuarioService(db)

    return service.obtener_usuario(
        id_usuario
    )


@router.post(
    "/",
    response_model=UsuarioResponse
)
def crear_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = UsuarioService(db)

    return service.crear_usuario(
        usuario
    )


@router.put(
    "/{id_usuario}",
    response_model=UsuarioResponse
)
def actualizar_usuario(
    id_usuario: int,
    usuario: UsuarioUpdate,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = UsuarioService(db)

    return service.actualizar_usuario(
        id_usuario,
        usuario
    )


@router.delete(
    "/{id_usuario}"
)
def eliminar_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    registrador = Depends(require_registrador),
):

    service = UsuarioService(db)

    service.eliminar_usuario(
        id_usuario,
        registrador.id_usuario,
    )

    return {
        "mensaje": "Usuario eliminado"
    }


@router.put("/{id_usuario}/estado")
def cambiar_estado_usuario(
    id_usuario: int,
    habilitado: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):
    usuario = UsuarioService(db).obtener_usuario(id_usuario)
    estado = set_account_disabled(id_usuario, not habilitado)
    return {
        "id_usuario": usuario.id_usuario,
        "habilitado": not bool(estado.get("disabled")),
        "mensaje": "Perfil habilitado y desbloqueado" if habilitado else "Perfil deshabilitado",
    }


@router.get("/{id_usuario}/estado")
def consultar_estado_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):
    usuario = UsuarioService(db).obtener_usuario(id_usuario)
    estado = get_account_state(id_usuario)
    return {
        "id_usuario": usuario.id_usuario,
        "habilitado": not bool(estado.get("disabled")),
        "intentos_fallidos": int(estado.get("failed", 0)),
        "bloqueado_temporalmente": bool(estado.get("blocked_until")),
    }
