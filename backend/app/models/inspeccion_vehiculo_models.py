import uuid

from sqlalchemy import JSON, UUID, Column, DateTime, ForeignKey, Index, Integer, String

from app.core.database import Base


class InspeccionVehiculo(Base):
    __tablename__ = "inspeccion_vehiculo"
    __table_args__ = (
        Index("ix_inspeccion_vehiculo_fecha", "vehiculo_id", "capturada_en"),
        Index("ix_inspeccion_conductor_fecha", "conductor_id", "capturada_en"),
    )

    id_inspeccion = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_inspection_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculo.id_vehiculo"), nullable=False, index=True)
    conductor_id = Column(Integer, ForeignKey("conductor.id_conductor"), nullable=False, index=True)
    viaje_id = Column(UUID(as_uuid=True), ForeignKey("viaje.id_viaje"), nullable=False, index=True)
    estado_general = Column(String(20), nullable=False)
    items = Column(JSON, nullable=False)
    capturada_en = Column(DateTime, nullable=False)
    sincronizada_en = Column(DateTime, nullable=False)
