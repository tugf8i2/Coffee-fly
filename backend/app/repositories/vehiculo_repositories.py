from sqlalchemy.orm import Session

from app.models.vehiculo_models import Vehiculo

from app.schemas.vehiculo_schemas import (
    VehiculoCreate,
    VehiculoUpdate
)


class VehiculoRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_vehiculo(
        self,
        id_vehiculo: int
    ) -> Vehiculo | None:

        return (
            self.db.query(Vehiculo)
            .filter(
                Vehiculo.id_vehiculo == id_vehiculo
            )
            .first()
        )


    def get_vehiculos(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Vehiculo]:

        return (
            self.db.query(Vehiculo)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_vehiculo(
        self,
        vehiculo: VehiculoCreate
    ) -> Vehiculo:

        db_vehiculo = Vehiculo(
            **vehiculo.model_dump()
        )

        self.db.add(
            db_vehiculo
        )

        self.db.commit()

        self.db.refresh(
            db_vehiculo
        )

        return db_vehiculo


    def update_vehiculo(
        self,
        id_vehiculo: int,
        vehiculo: VehiculoUpdate
    ) -> Vehiculo | None:

        db_vehiculo = (
            self.get_vehiculo(
                id_vehiculo
            )
        )

        if db_vehiculo is None:
            return None


        for key, value in (
            vehiculo
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_vehiculo,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_vehiculo
        )

        return db_vehiculo


    def delete_vehiculo(
        self,
        id_vehiculo: int
    ) -> Vehiculo | None:

        db_vehiculo = (
            self.get_vehiculo(
                id_vehiculo
            )
        )

        if db_vehiculo is None:
            return None


        self.db.delete(
            db_vehiculo
        )

        self.db.commit()

        return db_vehiculo