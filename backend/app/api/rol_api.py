from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.rol_schemas import (
    RolCreate,
    RolUpdate,
    RolResponse
)

from app.services.rol_services import RolService
from app.core.auth import require_registrador


router = APIRouter(
    prefix="/roles",
    tags=["Roles"],
    dependencies=[Depends(require_registrador)],
)


@router.get(
    "/",
    response_model=list[RolResponse]
)
def listar_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = RolService(db)

    return service.obtener_roles(
        skip,
        limit
    )


@router.get(
    "/{id_rol}",
    response_model=RolResponse
)
def obtener_rol(
    id_rol: int,
    db: Session = Depends(get_db)
):

    service = RolService(db)

    return service.obtener_rol(
        id_rol
    )


@router.post(
    "/",
    response_model=RolResponse
)
def crear_rol(
    rol: RolCreate,
    db: Session = Depends(get_db)
):

    service = RolService(db)

    return service.crear_rol(
        rol
    )


@router.put(
    "/{id_rol}",
    response_model=RolResponse
)
def actualizar_rol(
    id_rol: int,
    rol: RolUpdate,
    db: Session = Depends(get_db)
):

    service = RolService(db)

    return service.actualizar_rol(
        id_rol,
        rol
    )


@router.delete(
    "/{id_rol}"
)
def eliminar_rol(
    id_rol: int,
    db: Session = Depends(get_db)
):

    service = RolService(db)

    service.eliminar_rol(
        id_rol
    )

    return {
        "mensaje": "Rol eliminado"
    }
