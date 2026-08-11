from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.historial_eventos_schemas import (
    HistorialEventoCreate,
    HistorialEventoUpdate,
    HistorialEventoResponse
)

from app.services.historial_eventos_services import (
    HistorialEventoService
)


router = APIRouter(
    prefix="/historial-eventos",
    tags=["Historial Eventos"]
)


@router.get(
    "/",
    response_model=list[HistorialEventoResponse]
)
def get_historial_eventos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    service = HistorialEventoService(db)

    return service.obtener_historial_eventos(
        skip,
        limit
    )


@router.get(
    "/{id_evento}",
    response_model=HistorialEventoResponse
)
def get_historial_evento(
    id_evento: UUID,
    db: Session = Depends(get_db)
):

    service = HistorialEventoService(db)

    return service.obtener_historial_evento(
        id_evento
    )


@router.post(
    "/",
    response_model=HistorialEventoResponse
)
def post_historial_evento(
    evento: HistorialEventoCreate,
    db: Session = Depends(get_db)
):

    service = HistorialEventoService(db)

    return service.crear_historial_evento(
        evento
    )


@router.put(
    "/{id_evento}",
    response_model=HistorialEventoResponse
)
def put_historial_evento(
    id_evento: UUID,
    evento: HistorialEventoUpdate,
    db: Session = Depends(get_db)
):

    service = HistorialEventoService(db)

    return service.actualizar_historial_evento(
        id_evento,
        evento
    )


@router.delete(
    "/{id_evento}"
)
def delete_historial_evento(
    id_evento: UUID,
    db: Session = Depends(get_db)
):

    service = HistorialEventoService(db)

    return service.eliminar_historial_evento(
        id_evento
    )