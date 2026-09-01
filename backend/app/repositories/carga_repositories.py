from uuid import UUID

from sqlalchemy import func
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
        limit: int = 100,
        caficultor_id: int | None = None,
    ) -> list[Carga]:
        query = self.db.query(Carga)
        if caficultor_id is not None:
            query = query.filter(Carga.caficultor_id == caficultor_id)
        return query.offset(skip).limit(limit).all()

    def get_peso_asignado_vehiculo(self, vehiculo_id: int, excluir_carga_id: UUID | None = None) -> float:
        consulta = self.db.query(func.coalesce(func.sum(Carga.peso_kg), 0)).filter(
            Carga.vehiculo_id == vehiculo_id
        )
        if excluir_carga_id is not None:
            consulta = consulta.filter(Carga.id_carga != excluir_carga_id)
        return float(consulta.scalar() or 0)


    def create_carga(
        self,
        carga: CargaCreate,
        caficultor_id: int,
    ) -> Carga:

        db_carga = Carga(
            **carga.model_dump(),
            caficultor_id=caficultor_id,
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
