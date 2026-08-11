from sqlalchemy.orm import Session

from app.models.conductor_models import Conductor

from app.schemas.conductor_schemas import (
    ConductorCreate,
    ConductorUpdate
)


class ConductorRepository:

    def __init__(self, db: Session):
        self.db = db


    def get_conductor(
        self,
        id_conductor: int
    ) -> Conductor | None:

        return (
            self.db.query(Conductor)
            .filter(
                Conductor.id_conductor == id_conductor
            )
            .first()
        )


    def get_conductores(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Conductor]:

        return (
            self.db.query(Conductor)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_conductor(
        self,
        conductor: ConductorCreate
    ) -> Conductor:

        db_conductor = Conductor(
            **conductor.model_dump()
        )

        self.db.add(
            db_conductor
        )

        self.db.commit()

        self.db.refresh(
            db_conductor
        )

        return db_conductor


    def update_conductor(
        self,
        id_conductor: int,
        conductor: ConductorUpdate
    ) -> Conductor | None:

        db_conductor = self.get_conductor(
            id_conductor
        )

        if db_conductor is None:
            return None


        for key, value in (
            conductor
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_conductor,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_conductor
        )

        return db_conductor


    def delete_conductor(
        self,
        id_conductor: int
    ) -> Conductor | None:

        db_conductor = self.get_conductor(
            id_conductor
        )

        if db_conductor is None:
            return None


        self.db.delete(
            db_conductor
        )

        self.db.commit()

        return db_conductor