from sqlalchemy import UUID, Column, DateTime, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid


class HistorialEvento(Base):
    __tablename__ = "historial_de_eventos"
    __table_args__ = {"schema": "public"}

    id_evento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)


    carga_id = Column(UUID(as_uuid=True), ForeignKey("public.carga.id_carga"))
    descripcion_evento = Column(String(100))

    fecha_hora_evento = Column(DateTime)
    fecha_hora_sincronizacion = Column(DateTime)

    ubicacion_id = Column(UUID(as_uuid=True), ForeignKey("public.ubicacion.id_ubicacion"))
    conductor_id = Column(Integer, ForeignKey("public.conductor.id_conductor"))
    usuario_id_cambio = Column(Integer, ForeignKey("public.usuario.id_usuario"))