from uuid import UUID

from sqlalchemy.orm import Session

from app.models.historial_eventos_models import (
    HistorialEvento
)

from app.schemas.historial_eventos_schemas import (
    HistorialEventoCreate,
    HistorialEventoUpdate
)


class HistorialEventoRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_historial_evento(
        self,
        id_evento: UUID
    ) -> HistorialEvento | None:

        return (
            self.db.query(
                HistorialEvento
            )
            .filter(
                HistorialEvento.id_evento == id_evento
            )
            .first()
        )


    def get_historial_eventos(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[HistorialEvento]:

        return (
            self.db.query(
                HistorialEvento
            )
            .offset(skip)
            .limit(limit)
            .all()
        )


    def create_historial_evento(
        self,
        evento: HistorialEventoCreate
    ) -> HistorialEvento:

        db_evento = (
            HistorialEvento(
                **evento.model_dump()
            )
        )

        self.db.add(
            db_evento
        )

        self.db.commit()

        self.db.refresh(
            db_evento
        )

        return db_evento


    def update_historial_evento(
        self,
        id_evento: UUID,
        evento: HistorialEventoUpdate
    ) -> HistorialEvento | None:

        db_evento = (
            self.get_historial_evento(
                id_evento
            )
        )

        if db_evento is None:
            return None


        for key, value in (
            evento
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_evento,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_evento
        )

        return db_evento


    def delete_historial_evento(
        self,
        id_evento: UUID
    ) -> HistorialEvento | None:

        db_evento = (
            self.get_historial_evento(
                id_evento
            )
        )

        if db_evento is None:
            return None


        self.db.delete(
            db_evento
        )

        self.db.commit()

        return db_evento