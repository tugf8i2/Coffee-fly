import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class HistorialAsignacion(Base):
    __tablename__ = "historial_asignacion"
    id_asignacion = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entrega_id = Column(UUID(as_uuid=True), ForeignKey("entrega.id_entrega"), nullable=False)
    carga_id = Column(UUID(as_uuid=True), ForeignKey("carga.id_carga"), nullable=False)
    vehiculo_id = Column(Integer, ForeignKey("vehiculo.id_vehiculo"), nullable=False)
    conductor_id = Column(Integer, ForeignKey("conductor.id_conductor"), nullable=False)
    coordinador_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
    fecha_hora_asignacion = Column(DateTime, nullable=False)
