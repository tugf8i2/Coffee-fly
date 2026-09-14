import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Viaje(Base):
    __tablename__ = "viaje"
    __table_args__ = (Index(
        "uq_viaje_vehiculo_turno_activo",
        "vehiculo_id",
        "orden_cola",
        unique=True,
        postgresql_where=text("estado_viaje IN ('asignado', 'en_cola', 'en_camino')"),
    ),)

    id_viaje = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehiculo_id = Column(Integer, ForeignKey("vehiculo.id_vehiculo"), nullable=False, index=True)
    conductor_id = Column(Integer, ForeignKey("conductor.id_conductor"), nullable=False, index=True)
    coordinador_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
    cooperativa_id = Column(Integer, ForeignKey("cooperativa.id_cooperativa"), nullable=False)
    cooperativa_latitud_snapshot = Column(Float)
    cooperativa_longitud_snapshot = Column(Float)
    cooperativa_direccion_snapshot = Column(String(500))
    distancia_recorrida_m = Column(Float, nullable=False, default=0, server_default="0")
    estado_viaje = Column(String(20), nullable=False, index=True)
    orden_cola = Column(Integer, nullable=False)
    creado_en = Column(DateTime, nullable=False)
    iniciado_en = Column(DateTime)
    completado_en = Column(DateTime)

    entregas = relationship("Entrega", back_populates="viaje")
