from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.ruta_repositories import (
    RutaRepository
)

from app.schemas.ruta_schemas import (
    RutaCreate,
    RutaUpdate
)


class RutaService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            RutaRepository(
                db
            )
        )


    def obtener_rutas(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_rutas(
                skip,
                limit
            )
        )


    def obtener_ruta(
        self,
        id_ruta: int
    ):

        ruta = (
            self.repository
            .get_ruta(
                id_ruta
            )
        )

        if ruta is None:

            raise HTTPException(
                status_code=404,
                detail="Ruta no encontrada"
            )

        return ruta


    def crear_ruta(
        self,
        ruta: RutaCreate
    ):

        return (
            self.repository
            .create_ruta(
                ruta
            )
        )


    def actualizar_ruta(
        self,
        id_ruta: int,
        ruta: RutaUpdate
    ):

        ruta_actualizada = (
            self.repository
            .update_ruta(
                id_ruta,
                ruta
            )
        )

        if ruta_actualizada is None:

            raise HTTPException(
                status_code=404,
                detail="Ruta no encontrada"
            )

        return ruta_actualizada


    def eliminar_ruta(
        self,
        id_ruta: int
    ):

        eliminada = (
            self.repository
            .delete_ruta(
                id_ruta
            )
        )

        if eliminada is None:

            raise HTTPException(
                status_code=404,
                detail="Ruta no encontrada"
            )

        return {
            "mensaje":
            "Ruta eliminada"
        }