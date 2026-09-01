import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Entrega(Base):
    __tablename__ = "entrega"
    __table_args__ = (UniqueConstraint("solicitud_id", name="uq_entrega_solicitud_id"),)
    id_entrega = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    solicitud_id = Column(UUID(as_uuid=True), ForeignKey("solicitud.id_solicitud"), nullable=False)
    caficultor_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False, index=True)
    cantidad_kg = Column(Numeric(8, 2), nullable=False)
    fecha_hora_entrega = Column(DateTime, nullable=False, index=True)
    observaciones = Column(String(500))
    estado_entrega = Column(String(20), nullable=False, default="pendiente", index=True)
    actualizado_en = Column(DateTime, nullable=True)
    distancia_recorrida_m = Column(Float, nullable=False, default=0, server_default="0")

    solicitud = relationship("Solicitud")
    caficultor = relationship("Usuario")
    historial_estados = relationship(
        "HistorialEstadoEntrega", back_populates="entrega", cascade="all, delete-orphan"
    )
