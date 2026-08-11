from uuid import UUID
from datetime import datetime

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.carga_repositories import (
    CargaRepository
)

from app.schemas.carga_schemas import (
    CargaCreate,
    CargaUpdate
)


class CargaService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            CargaRepository(
                db
            )
        )


    def obtener_cargas(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_cargas(
                skip,
                limit
            )
        )


    def obtener_carga(
        self,
        id_carga: UUID
    ):

        carga = (
            self.repository
            .get_carga(
                id_carga
            )
        )

        if carga is None:

            raise HTTPException(
                status_code=404,
                detail="Carga no encontrada"
            )

        return carga


    def crear_carga(
        self,
        carga: CargaCreate
    ):

        return (
            self.repository
            .create_carga(
                carga
            )
        )


    def actualizar_carga(
        self,
        id_carga: UUID,
        carga: CargaUpdate
    ):

        datos = (
            carga
            .model_dump(
                exclude_unset=True
            )
        )


        datos[
            "actualizado_en"
        ] = (
            datetime.now()
        )


        carga_actualizada = (
            CargaUpdate(
                **datos
            )
        )


        resultado = (
            self.repository
            .update_carga(
                id_carga,
                carga_actualizada
            )
        )

        if resultado is None:

            raise HTTPException(
                status_code=404,
                detail="Carga no encontrada"
            )

        return resultado


    def eliminar_carga(
        self,
        id_carga: UUID
    ):

        eliminada = (
            self.repository
            .delete_carga(
                id_carga
            )
        )

        if eliminada is None:

            raise HTTPException(
                status_code=404,
                detail="Carga no encontrada"
            )

        return {
            "mensaje":
            "Carga eliminada"
        }