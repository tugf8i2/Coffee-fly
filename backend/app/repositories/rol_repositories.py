from sqlalchemy.orm import Session

from app.models.rol_models import Rol

from app.schemas.rol_schemas import (
    RolCreate,
    RolUpdate
)


class RolRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_rol(
        self,
        id_rol: int
    ) -> Rol | None:

        return (
            self.db.query(Rol)
            .filter(
                Rol.id_rol == id_rol
            )
            .first()
        )


    def get_roles(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Rol]:

        return (
            self.db.query(Rol)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_rol(
        self,
        rol: RolCreate
    ) -> Rol:

        db_rol = Rol(
            **rol.model_dump()
        )

        self.db.add(
            db_rol
        )

        self.db.commit()

        self.db.refresh(
            db_rol
        )

        return db_rol


    def update_rol(
        self,
        id_rol: int,
        rol: RolUpdate
    ) -> Rol | None:

        db_rol = self.get_rol(
            id_rol
        )

        if db_rol is None:
            return None


        for key, value in (
            rol
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_rol,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_rol
        )

        return db_rol


    def delete_rol(
        self,
        id_rol: int
    ) -> Rol | None:

        db_rol = self.get_rol(
            id_rol
        )

        if db_rol is None:
            return None


        self.db.delete(
            db_rol
        )

        self.db.commit()

        return db_rol