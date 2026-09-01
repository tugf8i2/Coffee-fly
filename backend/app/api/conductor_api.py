from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.conductor_schemas import (
    ConductorCreate,
    ConductorUpdate,
    ConductorResponse
)

from app.services.conductor_services import ConductorService
from app.core.auth import require_registrador


router = APIRouter(
    prefix="/conductores",
    tags=["Conductores"],
    dependencies=[Depends(require_registrador)],
)


@router.get(
    "/",
    response_model=list[ConductorResponse]
)
def listar_conductores(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = ConductorService(db)

    return service.obtener_conductores(
        skip,
        limit
    )


@router.get(
    "/{id_conductor}",
    response_model=ConductorResponse
)
def obtener_conductor(
    id_conductor: int,
    db: Session = Depends(get_db)
):

    service = ConductorService(db)

    return service.obtener_conductor(
        id_conductor
    )


@router.post(
    "/",
    response_model=ConductorResponse
)
def crear_conductor(
    conductor: ConductorCreate,
    db: Session = Depends(get_db)
):

    service = ConductorService(db)

    return service.crear_conductor(
        conductor
    )


@router.put(
    "/{id_conductor}",
    response_model=ConductorResponse
)
def actualizar_conductor(
    id_conductor: int,
    conductor: ConductorUpdate,
    db: Session = Depends(get_db)
):

    service = ConductorService(db)

    return service.actualizar_conductor(
        id_conductor,
        conductor
    )


@router.delete(
    "/{id_conductor}"
)
def eliminar_conductor(
    id_conductor: int,
    db: Session = Depends(get_db)
):

    service = ConductorService(db)

    service.eliminar_conductor(
        id_conductor
    )

    return {
        "mensaje": "Conductor eliminado"
    }
