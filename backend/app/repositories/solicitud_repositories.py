from uuid import UUID

from sqlalchemy.orm import Session

from app.models.solicitud_models import Solicitud
from app.models.carga_models import Carga

from app.schemas.solicitud_schemas import (
    SolicitudCreate,
    SolicitudUpdate
)


class SolicitudRepository:

    def __init__(
        self,
        db: Session
    ):
        self.db = db


    def get_solicitud(
        self,
        id_solicitud: UUID
    ) -> Solicitud | None:

        return (
            self.db.query(Solicitud)
            .filter(
                Solicitud.id_solicitud == id_solicitud
            )
            .first()
        )


    def get_solicitudes(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Solicitud]:

        return (
            self.db.query(Solicitud)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_solicitudes_por_caficultor(self, caficultor_id: int):
        return (
            self.db.query(Solicitud, Carga)
            .outerjoin(Carga, Solicitud.carga_id == Carga.id_carga)
            .filter(Solicitud.caficultor_id == caficultor_id)
            .order_by(Solicitud.fecha_hora_solicitud.desc())
            .all()
        )

    def get_seguimiento_por_caficultor(self, caficultor_id: int):
        return (
            self.db.query(Solicitud, Carga)
            .outerjoin(Carga, Solicitud.carga_id == Carga.id_carga)
            .filter(
                Solicitud.caficultor_id == caficultor_id,
                Solicitud.estado_solicitud.in_(["pendiente", "en camino"]),
                Carga.vehiculo_id.isnot(None),
            )
            .order_by(Solicitud.fecha_hora_solicitud.desc())
            .first()
        )


    def create_solicitud(
        self,
        solicitud: SolicitudCreate
    ) -> Solicitud:

        db_solicitud = Solicitud(
            **solicitud.model_dump()
        )

        self.db.add(
            db_solicitud
        )

        self.db.commit()

        self.db.refresh(
            db_solicitud
        )

        return db_solicitud


    def update_solicitud(
        self,
        id_solicitud: UUID,
        solicitud: SolicitudUpdate
    ) -> Solicitud | None:

        db_solicitud = (
            self.get_solicitud(
                id_solicitud
            )
        )

        if db_solicitud is None:
            return None


        for key, value in (
            solicitud
            .model_dump(
                exclude_unset=True
            )
            .items()
        ):

            setattr(
                db_solicitud,
                key,
                value
            )


        self.db.commit()

        self.db.refresh(
            db_solicitud
        )

        return db_solicitud


    def delete_solicitud(
        self,
        id_solicitud: UUID
    ) -> Solicitud | None:

        db_solicitud = (
            self.get_solicitud(
                id_solicitud
            )
        )

        if db_solicitud is None:
            return None


        self.db.delete(
            db_solicitud
        )

        self.db.commit()

        return db_solicitud
