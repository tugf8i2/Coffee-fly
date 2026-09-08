import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class MensajeSoporte(Base):
    __tablename__ = "mensaje_soporte"
    __table_args__ = (
        Index("ix_mensaje_soporte_entrega_fecha", "entrega_id", "fecha_hora"),
    )

    id_mensaje = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entrega_id = Column(UUID(as_uuid=True), ForeignKey("entrega.id_entrega"), nullable=False)
    remitente_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)
    mensaje = Column(String(800), nullable=False)
    fecha_hora = Column(DateTime, nullable=False)
    leido_en = Column(DateTime, nullable=True)
