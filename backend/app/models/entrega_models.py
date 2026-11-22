import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Entrega(Base):
    __tablename__ = "entrega"
    __table_args__ = {"schema": "public"}

    id_entrega = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    solicitud_id = Column(UUID(as_uuid=True), ForeignKey("public.solicitud.id_solicitud"), nullable=False, unique=True)
    caficultor_id = Column(ForeignKey("public.usuario.id_usuario"), nullable=False)
    cantidad_kg = Column(Numeric(8, 2), nullable=False)
    fecha_hora = Column(DateTime, nullable=False)
    observaciones = Column(String(100), nullable=True)
    estado_entrega = Column(String(20), nullable=False, default="Pendiente")

    solicitud = relationship("Solicitud")
    caficultor = relationship("Usuario")
