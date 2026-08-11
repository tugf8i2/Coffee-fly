from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.rol_repositories import (
    RolRepository
)

from app.schemas.rol_schemas import (
    RolCreate,
    RolUpdate
)


class RolService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            RolRepository(db)
        )


    def obtener_roles(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_roles(
                skip,
                limit
            )
        )


    def obtener_rol(
        self,
        id_rol: int
    ):

        rol = (
            self.repository
            .get_rol(
                id_rol
            )
        )

        if rol is None:

            raise HTTPException(
                status_code=404,
                detail="Rol no encontrado"
            )

        return rol


    def crear_rol(
        self,
        rol: RolCreate
    ):

        return (
            self.repository
            .create_rol(
                rol
            )
        )


    def actualizar_rol(
        self,
        id_rol: int,
        rol: RolUpdate
    ):

        db_rol = (
            self.repository
            .update_rol(
                id_rol,
                rol
            )
        )

        if db_rol is None:

            raise HTTPException(
                status_code=404,
                detail="Rol no encontrado"
            )

        return db_rol


    def eliminar_rol(
        self,
        id_rol: int
    ):

        db_rol = (
            self.repository
            .delete_rol(
                id_rol
            )
        )

        if db_rol is None:

            raise HTTPException(
                status_code=404,
                detail="Rol no encontrado"
            )

        return {
            "mensaje":
            "Rol eliminado"
        }