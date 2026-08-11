from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.historial_eventos_repositories import (
    HistorialEventoRepository
)

from app.schemas.historial_eventos_schemas import (
    HistorialEventoCreate,
    HistorialEventoUpdate
)


class HistorialEventoService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            HistorialEventoRepository(
                db
            )
        )


    def obtener_historial_eventos(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_historial_eventos(
                skip,
                limit
            )
        )


    def obtener_historial_evento(
        self,
        id_evento: UUID
    ):

        evento = (
            self.repository
            .get_historial_evento(
                id_evento
            )
        )

        if evento is None:

            raise HTTPException(
                status_code=404,
                detail="Evento no encontrado"
            )

        return evento


    def crear_historial_evento(
        self,
        evento: HistorialEventoCreate
    ):

        return (
            self.repository
            .create_historial_evento(
                evento
            )
        )


    def actualizar_historial_evento(
        self,
        id_evento: UUID,
        evento: HistorialEventoUpdate
    ):

        actualizado = (
            self.repository
            .update_historial_evento(
                id_evento,
                evento
            )
        )

        if actualizado is None:

            raise HTTPException(
                status_code=404,
                detail="Evento no encontrado"
            )

        return actualizado


    def eliminar_historial_evento(
        self,
        id_evento: UUID
    ):

        eliminado = (
            self.repository
            .delete_historial_evento(
                id_evento
            )
        )

        if eliminado is None:

            raise HTTPException(
                status_code=404,
                detail="Evento no encontrado"
            )

        return {
            "mensaje":
            "Evento eliminado"
        }