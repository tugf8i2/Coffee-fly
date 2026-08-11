from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.cooperativa_repositories import (
    CooperativaRepository
)

from app.schemas.cooperativa_schemas import (
    CooperativaCreate,
    CooperativaUpdate
)


class CooperativaService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            CooperativaRepository(
                db
            )
        )


    def obtener_cooperativas(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_cooperativas(
                skip,
                limit
            )
        )


    def obtener_cooperativa(
        self,
        cooperativa_id: int
    ):

        cooperativa = (
            self.repository
            .get_cooperativa(
                cooperativa_id
            )
        )

        if cooperativa is None:

            raise HTTPException(
                status_code=404,
                detail="Cooperativa no encontrada"
            )

        return cooperativa


    def crear_cooperativa(
        self,
        cooperativa: CooperativaCreate
    ):

        return (
            self.repository
            .create_cooperativa(
                cooperativa
            )
        )


    def actualizar_cooperativa(
        self,
        cooperativa_id: int,
        cooperativa: CooperativaUpdate
    ):

        cooperativa_actualizada = (
            self.repository
            .update_cooperativa(
                cooperativa_id,
                cooperativa
            )
        )

        if cooperativa_actualizada is None:

            raise HTTPException(
                status_code=404,
                detail="Cooperativa no encontrada"
            )

        return cooperativa_actualizada


    def eliminar_cooperativa(
        self,
        cooperativa_id: int
    ):

        eliminada = (
            self.repository
            .delete_cooperativa(
                cooperativa_id
            )
        )

        if eliminada is None:

            raise HTTPException(
                status_code=404,
                detail="Cooperativa no encontrada"
            )

        return {
            "mensaje":
            "Cooperativa eliminada"
        }