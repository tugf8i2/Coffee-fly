from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.ruta_schemas import (
    RutaCreate,
    RutaUpdate,
    RutaResponse
)

from app.services.ruta_services import (
    RutaService
)
from app.core.auth import require_roles


router = APIRouter(
    prefix="/rutas",
    tags=["Rutas"],
    dependencies=[Depends(require_roles("coordinador"))],
)


@router.get(
    "/",
    response_model=list[RutaResponse]
)
def listar_rutas(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = RutaService(db)

    return service.obtener_rutas(
        skip,
        limit
    )


@router.get(
    "/{id_ruta}",
    response_model=RutaResponse
)
def obtener_ruta(
    id_ruta: int,
    db: Session = Depends(get_db)
):

    service = RutaService(db)

    return service.obtener_ruta(
        id_ruta
    )


@router.post(
    "/",
    response_model=RutaResponse
)
def crear_ruta(
    ruta: RutaCreate,
    db: Session = Depends(get_db)
):

    service = RutaService(db)

    return service.crear_ruta(
        ruta
    )


@router.put(
    "/{id_ruta}",
    response_model=RutaResponse
)
def actualizar_ruta(
    id_ruta: int,
    ruta: RutaUpdate,
    db: Session = Depends(get_db)
):

    service = RutaService(db)

    return service.actualizar_ruta(
        id_ruta,
        ruta
    )


@router.delete(
    "/{id_ruta}"
)
def eliminar_ruta(
    id_ruta: int,
    db: Session = Depends(get_db)
):

    service = RutaService(db)

    return service.eliminar_ruta(
        id_ruta
    )
