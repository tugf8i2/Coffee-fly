from sqlalchemy.orm import Session

from app.models.ruta_models import Ruta

from app.schemas.ruta_schemas import (
    RutaCreate,
    RutaUpdate
)


class RutaRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_ruta(
        self,
        id_ruta: int
    ) -> Ruta | None:

        return (
            self.db.query(Ruta)
            .filter(
                Ruta.id_ruta == id_ruta
            )
            .first()
        )


    def get_rutas(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Ruta]:

        return (
            self.db.query(Ruta)
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_ruta(
        self,
        ruta: RutaCreate
    ) -> Ruta:

        db_ruta = Ruta(
            **ruta.model_dump()
        )

        self.db.add(
            db_ruta
        )

        self.db.commit()

        self.db.refresh(
            db_ruta
        )

        return db_ruta


    def update_ruta(
        self,
        id_ruta: int,
        ruta: RutaUpdate
    ) -> Ruta | None:

        db_ruta = (
            self.get_ruta(
                id_ruta
            )
        )

        if db_ruta is None:
            return None


        for key, value in (
            ruta
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_ruta,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_ruta
        )

        return db_ruta


    def delete_ruta(
        self,
        id_ruta: int
    ) -> Ruta | None:

        db_ruta = (
            self.get_ruta(
                id_ruta
            )
        )

        if db_ruta is None:
            return None


        self.db.delete(
            db_ruta
        )

        self.db.commit()

        return db_ruta