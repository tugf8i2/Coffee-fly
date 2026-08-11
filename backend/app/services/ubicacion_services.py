from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.ubicacion_repositories import (
    UbicacionRepository
)

from app.schemas.ubicacion_schemas import (
    UbicacionCreate,
    UbicacionUpdate
)


class UbicacionService:

    def __init__(self, db: Session):
        self.repository = UbicacionRepository(db)


    def obtener_ubicacion(
        self,
        id_ubicacion
    ):

        ubicacion = self.repository.get_ubicacion(
            id_ubicacion
        )

        if ubicacion is None:
            raise HTTPException(
                status_code=404,
                detail="Ubicación no encontrada"
            )

        return ubicacion


    def obtener_ubicaciones(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return self.repository.get_ubicaciones(
            skip,
            limit
        )


    def crear_ubicacion(
        self,
        ubicacion: UbicacionCreate
    ):

        return self.repository.create_ubicacion(
            ubicacion
        )


    def actualizar_ubicacion(
        self,
        id_ubicacion,
        ubicacion: UbicacionUpdate
    ):

        ubicacion_actualizada = (
            self.repository.update_ubicacion(
                id_ubicacion,
                ubicacion
            )
        )

        if ubicacion_actualizada is None:
            raise HTTPException(
                status_code=404,
                detail="Ubicación no encontrada"
            )

        return ubicacion_actualizada


    def eliminar_ubicacion(
        self,
        id_ubicacion
    ):

        ubicacion = (
            self.repository.delete_ubicacion(
                id_ubicacion
            )
        )

        if ubicacion is None:
            raise HTTPException(
                status_code=404,
                detail="Ubicación no encontrada"
            )

        return {
            "mensaje": "Ubicación eliminada"
        }