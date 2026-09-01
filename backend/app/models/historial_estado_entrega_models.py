import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class HistorialEstadoEntrega(Base):
    __tablename__ = "historial_estado_entrega"
    id_historial = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entrega_id = Column(
        UUID(as_uuid=True), ForeignKey("entrega.id_entrega", ondelete="CASCADE"), nullable=False, index=True
    )
    estado_anterior = Column(String(20), nullable=False)
    estado_nuevo = Column(String(20), nullable=False)
    usuario_id = Column(ForeignKey("usuario.id_usuario"), nullable=False)
    fecha_hora_cambio = Column(DateTime, nullable=False, index=True)

    entrega = relationship("Entrega", back_populates="historial_estados")
    usuario = relationship("Usuario")
