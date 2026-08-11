from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.vehiculo_repositories import (
    VehiculoRepository
)

from app.schemas.vehiculo_schemas import (
    VehiculoCreate,
    VehiculoUpdate
)


class VehiculoService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            VehiculoRepository(
                db
            )
        )


    def obtener_vehiculos(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_vehiculos(
                skip,
                limit
            )
        )


    def obtener_vehiculo(
        self,
        id_vehiculo: int
    ):

        vehiculo = (
            self.repository
            .get_vehiculo(
                id_vehiculo
            )
        )

        if vehiculo is None:

            raise HTTPException(
                status_code=404,
                detail="Vehículo no encontrado"
            )

        return vehiculo


    def crear_vehiculo(
        self,
        vehiculo: VehiculoCreate
    ):

        return (
            self.repository
            .create_vehiculo(
                vehiculo
            )
        )


    def actualizar_vehiculo(
        self,
        id_vehiculo: int,
        vehiculo: VehiculoUpdate
    ):

        actualizado = (
            self.repository
            .update_vehiculo(
                id_vehiculo,
                vehiculo
            )
        )

        if actualizado is None:

            raise HTTPException(
                status_code=404,
                detail="Vehículo no encontrado"
            )

        return actualizado


    def eliminar_vehiculo(
        self,
        id_vehiculo: int
    ):

        eliminado = (
            self.repository
            .delete_vehiculo(
                id_vehiculo
            )
        )

        if eliminado is None:

            raise HTTPException(
                status_code=404,
                detail="Vehículo no encontrado"
            )

        return {
            "mensaje":
            "Vehículo eliminado"
        }