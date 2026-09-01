from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.carga_schemas import (
    CargaCreate,
    CargaUpdate,
    CargaResponse
)

from app.services.carga_services import (
    CargaService
)
from app.core.auth import require_roles
from app.models.usuario_models import Usuario


router = APIRouter(
    prefix="/cargas",
    tags=["Cargas"]
)


@router.get(
    "/",
    response_model=list[CargaResponse]
)
def listar_cargas(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = CargaService(db)

    return service.obtener_cargas(
        usuario, skip, limit
    )


@router.get(
    "/{id_carga}",
    response_model=CargaResponse
)
def obtener_carga(
    id_carga: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = CargaService(db)

    return service.obtener_carga(
        id_carga, usuario
    )


@router.post(
    "/",
    response_model=CargaResponse
)
def crear_carga(
    carga: CargaCreate,
    db: Session = Depends(get_db),
    caficultor: Usuario = Depends(require_roles("caficultor")),
):

    service = CargaService(db)

    return service.crear_carga(
        carga, caficultor.id_usuario
    )


@router.put(
    "/{id_carga}",
    response_model=CargaResponse
)
def actualizar_carga(
    id_carga: UUID,
    carga: CargaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = CargaService(db)

    return service.actualizar_carga(
        id_carga,
        carga, usuario
    )


@router.delete(
    "/{id_carga}"
)
def eliminar_carga(
    id_carga: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = CargaService(db)

    return service.eliminar_carga(
        id_carga, usuario
    )
