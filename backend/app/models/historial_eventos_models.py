from sqlalchemy import UUID, Column, DateTime, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid


class HistorialEvento(Base):
    __tablename__ = "historial_de_eventos"
    id_evento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)


    carga_id = Column(UUID(as_uuid=True), ForeignKey("carga.id_carga"), nullable=False)
    descripcion_evento = Column(String(100), nullable=False)

    fecha_hora_evento = Column(DateTime, nullable=False)
    fecha_hora_sincronizacion = Column(DateTime, nullable=False)

    ubicacion_id = Column(UUID(as_uuid=True), ForeignKey("ubicacion.id_ubicacion"))
    conductor_id = Column(Integer, ForeignKey("conductor.id_conductor"))
    usuario_id_cambio = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
