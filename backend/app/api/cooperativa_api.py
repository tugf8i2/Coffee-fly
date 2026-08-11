from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.cooperativa_schemas import (
    CooperativaCreate,
    CooperativaUpdate,
    CooperativaResponse
)

from app.services.cooperativa_Services import (
    CooperativaService
)


router = APIRouter(
    prefix="/cooperativas",
    tags=["Cooperativas"]
)


@router.get(
    "/",
    response_model=list[CooperativaResponse]
)
def listar_cooperativas(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = CooperativaService(db)

    return service.obtener_cooperativas(
        skip,
        limit
    )


@router.get(
    "/{id_cooperativa}",
    response_model=CooperativaResponse
)
def obtener_cooperativa(
    id_cooperativa: int,
    db: Session = Depends(get_db)
):

    service = CooperativaService(db)

    return service.obtener_cooperativa(
        id_cooperativa
    )


@router.post(
    "/",
    response_model=CooperativaResponse
)
def crear_cooperativa(
    cooperativa: CooperativaCreate,
    db: Session = Depends(get_db)
):

    service = CooperativaService(db)

    return service.crear_cooperativa(
        cooperativa
    )


@router.put(
    "/{id_cooperativa}",
    response_model=CooperativaResponse
)
def actualizar_cooperativa(
    id_cooperativa: int,
    cooperativa: CooperativaUpdate,
    db: Session = Depends(get_db)
):

    service = CooperativaService(db)

    return service.actualizar_cooperativa(
        id_cooperativa,
        cooperativa
    )


@router.delete(
    "/{id_cooperativa}"
)
def eliminar_cooperativa(
    id_cooperativa: int,
    db: Session = Depends(get_db)
):

    service = CooperativaService(db)

    return service.eliminar_cooperativa(
        id_cooperativa
    )