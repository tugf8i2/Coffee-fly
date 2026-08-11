from sqlalchemy.orm import Session

from app.models.cooperativa_models import Cooperativa

from app.schemas.cooperativa_schemas import (
    CooperativaCreate,
    CooperativaUpdate
)


class CooperativaRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_cooperativa(
        self,
        cooperativa_id: int
    ) -> Cooperativa | None:

        return (
            self.db.query(Cooperativa)
            .filter(
                Cooperativa.id_cooperativa == cooperativa_id
            )
            .first()
        )


    def get_cooperativas(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Cooperativa]:

        return (
            self.db.query(Cooperativa)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_cooperativa(
        self,
        cooperativa: CooperativaCreate
    ) -> Cooperativa:

        db_cooperativa = Cooperativa(
            **cooperativa.model_dump()
        )

        self.db.add(
            db_cooperativa
        )

        self.db.commit()

        self.db.refresh(
            db_cooperativa
        )

        return db_cooperativa


    def update_cooperativa(
        self,
        cooperativa_id: int,
        cooperativa: CooperativaUpdate
    ) -> Cooperativa | None:

        db_cooperativa = (
            self.get_cooperativa(
                cooperativa_id
            )
        )

        if db_cooperativa is None:
            return None


        for key, value in (
            cooperativa
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_cooperativa,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_cooperativa
        )

        return db_cooperativa


    def delete_cooperativa(
        self,
        cooperativa_id: int
    ) -> Cooperativa | None:

        db_cooperativa = (
            self.get_cooperativa(
                cooperativa_id
            )
        )

        if db_cooperativa is None:
            return None


        self.db.delete(
            db_cooperativa
        )

        self.db.commit()

        return db_cooperativa