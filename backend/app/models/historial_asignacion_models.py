import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class HistorialAsignacion(Base):
    __tablename__ = "historial_asignacion"
    __table_args__ = {"schema": "public"}

    id_asignacion = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entrega_id = Column(UUID(as_uuid=True), ForeignKey("public.entrega.id_entrega"), nullable=False)
    carga_id = Column(UUID(as_uuid=True), ForeignKey("public.carga.id_carga"), nullable=False)
    vehiculo_id = Column(Integer, ForeignKey("public.vehiculo.id_vehiculo"), nullable=False)
    conductor_id = Column(Integer, ForeignKey("public.conductor.id_conductor"), nullable=False)
    coordinador_id = Column(Integer, ForeignKey("public.usuario.id_usuario"), nullable=False)
    fecha_hora_asignacion = Column(DateTime, nullable=False)
