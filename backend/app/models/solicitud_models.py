from sqlalchemy import Column, DateTime, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Solicitud(Base):
    __tablename__ = "solicitud"
    __table_args__ = {"schema": "public"}

    id_solicitud = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, nullable=False)

    estado_solicitud = Column(String(20), nullable=False)
    fecha_hora_solicitud = Column(DateTime, nullable=False)

    estado_sincronizacion = Column(
    String(20),
    nullable=False,
    default="pendiente"
)

    caficultor_id = Column(Integer, ForeignKey("public.usuario.id_usuario"))
    carga_id = Column(UUID(as_uuid=True), ForeignKey("public.carga.id_carga"))

    

    caficultor = relationship("Usuario")
    carga = relationship("Carga")