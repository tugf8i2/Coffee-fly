from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.ubicacion_schemas import (
    UbicacionCreate,
    UbicacionUpdate,
    UbicacionResponse
)

from app.services.ubicacion_services import (
    UbicacionService
)
from app.core.auth import require_roles


router = APIRouter(
    prefix="/ubicaciones",
    tags=["Ubicaciones"],
    dependencies=[Depends(require_roles("coordinador"))],
)


@router.get(
    "/",
    response_model=list[UbicacionResponse]
)
def listar_ubicaciones(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = UbicacionService(db)

    return service.obtener_ubicaciones(
        skip,
        limit
    )


@router.get(
    "/{id_ubicacion}",
    response_model=UbicacionResponse
)
def obtener_ubicacion(
    id_ubicacion: UUID,
    db: Session = Depends(get_db)
):

    service = UbicacionService(db)

    return service.obtener_ubicacion(
        id_ubicacion
    )


@router.post(
    "/",
    response_model=UbicacionResponse
)
def crear_ubicacion(
    ubicacion: UbicacionCreate,
    db: Session = Depends(get_db)
):

    service = UbicacionService(db)

    return service.crear_ubicacion(
        ubicacion
    )


@router.put(
    "/{id_ubicacion}",
    response_model=UbicacionResponse
)
def actualizar_ubicacion(
    id_ubicacion: UUID,
    ubicacion: UbicacionUpdate,
    db: Session = Depends(get_db)
):

    service = UbicacionService(db)

    return service.actualizar_ubicacion(
        id_ubicacion,
        ubicacion
    )


@router.delete(
    "/{id_ubicacion}"
)
def eliminar_ubicacion(
    id_ubicacion: UUID,
    db: Session = Depends(get_db)
):

    service = UbicacionService(db)

    return service.eliminar_ubicacion(
        id_ubicacion
    )
