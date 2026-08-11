from uuid import UUID
from sqlalchemy.orm import Session

from app.models.ubicacion_models import Ubicacion

from app.schemas.ubicacion_schemas import (UbicacionCreate,UbicacionUpdate)


class UbicacionRepository:

    def __init__(self, db: Session):
        self.db = db


    def get_ubicacion(
        self,
        id_ubicacion: UUID
    ) -> Ubicacion | None:

        return (
            self.db.query(Ubicacion)
            .filter(
                Ubicacion.id_ubicacion == id_ubicacion
            )
            .first()
        )


    def get_ubicaciones(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Ubicacion]:

        return (
            self.db.query(Ubicacion)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_ubicacion(
        self,
        ubicacion: UbicacionCreate
    ) -> Ubicacion:

        db_ubicacion = Ubicacion(
            **ubicacion.model_dump()
        )

        self.db.add(
            db_ubicacion
        )

        self.db.commit()

        self.db.refresh(
            db_ubicacion
        )

        return db_ubicacion


    def update_ubicacion(
        self,
        id_ubicacion: UUID,
        ubicacion: UbicacionUpdate
    ) -> Ubicacion | None:

        db_ubicacion = self.get_ubicacion(
            id_ubicacion
        )

        if db_ubicacion is None:
            return None


        for key, value in (
            ubicacion
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_ubicacion,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_ubicacion
        )

        return db_ubicacion


    def delete_ubicacion(
        self,
        id_ubicacion: UUID
    ) -> Ubicacion | None:

        db_ubicacion = self.get_ubicacion(
            id_ubicacion
        )

        if db_ubicacion is None:
            return None


        self.db.delete(
            db_ubicacion
        )

        self.db.commit()

        return db_ubicacion