from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.conductor_repositories import (
    ConductorRepository
)

from app.schemas.conductor_schemas import (
    ConductorCreate,
    ConductorUpdate
)


class ConductorService:

    def __init__(self, db: Session):
        self.repository = ConductorRepository(db)


    def obtener_conductor(
        self,
        id_conductor: int
    ):

        conductor = self.repository.get_conductor(
            id_conductor
        )

        if conductor is None:
            raise HTTPException(
                status_code=404,
                detail="Conductor no encontrado"
            )

        return conductor


    def obtener_conductores(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return self.repository.get_conductores(
            skip,
            limit
        )


    def crear_conductor(
        self,
        conductor: ConductorCreate
    ):

        return self.repository.create_conductor(
            conductor
        )


    def actualizar_conductor(
        self,
        id_conductor: int,
        conductor: ConductorUpdate
    ):

        conductor_actualizado = (
            self.repository.update_conductor(
                id_conductor,
                conductor
            )
        )

        if conductor_actualizado is None:
            raise HTTPException(
                status_code=404,
                detail="Conductor no encontrado"
            )

        return conductor_actualizado


    def eliminar_conductor(
        self,
        id_conductor: int
    ):

        conductor = (
            self.repository.delete_conductor(
                id_conductor
            )
        )

        if conductor is None:
            raise HTTPException(
                status_code=404,
                detail="Conductor no encontrado"
            )

        return {
            "mensaje": "Conductor eliminado"
        }