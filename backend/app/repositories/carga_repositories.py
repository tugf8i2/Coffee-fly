from uuid import UUID

from sqlalchemy.orm import Session

from app.models.carga_models import Carga

from app.schemas.carga_schemas import (
    CargaCreate,
    CargaUpdate
)


class CargaRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_carga(
        self,
        id_carga: UUID
    ) -> Carga | None:

        return (
            self.db.query(Carga)
            .filter(
                Carga.id_carga == id_carga
            )
            .first()
        )


    def get_cargas(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Carga]:

        return (
            self.db.query(Carga)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_carga(
        self,
        carga: CargaCreate
    ) -> Carga:

        db_carga = Carga(
            **carga.model_dump()
        )

        self.db.add(
            db_carga
        )

        self.db.commit()

        self.db.refresh(
            db_carga
        )

        return db_carga


    def update_carga(
        self,
        id_carga: UUID,
        carga: CargaUpdate
    ) -> Carga | None:

        db_carga = (
            self.get_carga(
                id_carga
            )
        )

        if db_carga is None:
            return None


        for key, value in (
            carga
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_carga,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_carga
        )

        return db_carga


    def delete_carga(
        self,
        id_carga: UUID
    ) -> Carga | None:

        db_carga = (
            self.get_carga(
                id_carga
            )
        )

        if db_carga is None:
            return None


        self.db.delete(
            db_carga
        )

        self.db.commit()

        return db_carga