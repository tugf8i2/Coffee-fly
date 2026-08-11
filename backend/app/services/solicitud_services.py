from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.solicitud_repositories import (
    SolicitudRepository
)

from app.schemas.solicitud_schemas import (
    SolicitudCreate,
    SolicitudUpdate
)


class SolicitudService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            SolicitudRepository(
                db
            )
        )


    def obtener_solicitudes(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_solicitudes(
                skip,
                limit
            )
        )


    def obtener_solicitud(
        self,
        id_solicitud: UUID
    ):

        solicitud = (
            self.repository
            .get_solicitud(
                id_solicitud
            )
        )

        if solicitud is None:

            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada"
            )

        return solicitud


    def crear_solicitud(
        self,
        solicitud: SolicitudCreate
    ):

        return (
            self.repository
            .create_solicitud(
                solicitud
            )
        )


    def actualizar_solicitud(
        self,
        id_solicitud: UUID,
        solicitud: SolicitudUpdate
    ):

        actualizada = (
            self.repository
            .update_solicitud(
                id_solicitud,
                solicitud
            )
        )

        if actualizada is None:

            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada"
            )

        return actualizada


    def eliminar_solicitud(
        self,
        id_solicitud: UUID
    ):

        eliminada = (
            self.repository
            .delete_solicitud(
                id_solicitud
            )
        )

        if eliminada is None:

            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada"
            )

        return {
            "mensaje":
            "Solicitud eliminada"
        }