from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.entrega_models import Entrega
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario


class EntregaRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_solicitud_activa(self, solicitud_id: UUID) -> Solicitud | None:
        return self.db.query(Solicitud).filter(
            Solicitud.id_solicitud == solicitud_id,
            Solicitud.estado_solicitud == "pendiente",
        ).first()

    def get_by_solicitud(self, solicitud_id: UUID) -> Entrega | None:
        return self.db.query(Entrega).filter(Entrega.solicitud_id == solicitud_id).first()

    def get_solicitudes_disponibles(self):
        return self.db.query(Solicitud).outerjoin(
            Entrega, Entrega.solicitud_id == Solicitud.id_solicitud
        ).filter(
            Solicitud.estado_solicitud == "pendiente",
            Entrega.id_entrega.is_(None),
        ).order_by(Solicitud.fecha_hora_solicitud.desc()).all()

    def create(self, entrega: Entrega) -> Entrega:
        self.db.add(entrega)
        self.db.commit()
        self.db.refresh(entrega)
        return entrega

    def get_del_dia(self, inicio: datetime, fin: datetime):
        return self.db.query(Entrega, Usuario).join(
            Usuario, Entrega.caficultor_id == Usuario.id_usuario
        ).filter(
            Entrega.fecha_hora >= inicio,
            Entrega.fecha_hora < fin,
        ).order_by(Entrega.fecha_hora.desc()).all()
