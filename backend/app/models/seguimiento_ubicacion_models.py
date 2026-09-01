import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Numeric, text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class SeguimientoUbicacion(Base):
    __tablename__ = "seguimiento_ubicacion"
    __table_args__ = (
        Index(
            "ux_seguimiento_client_point_id",
            "client_point_id",
            unique=True,
            postgresql_where=text("client_point_id IS NOT NULL"),
        ),
        Index("ix_seguimiento_entrega_fecha", "entrega_id", "registrada_en"),
        Index("ix_seguimiento_vehiculo_id", "vehiculo_id"),
    )
    id_ubicacion = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_point_id = Column(UUID(as_uuid=True), nullable=True)
    entrega_id = Column(UUID(as_uuid=True), ForeignKey("entrega.id_entrega"), nullable=False)
    vehiculo_id = Column(ForeignKey("vehiculo.id_vehiculo"), nullable=False)
    latitud = Column(Numeric(9, 6), nullable=False)
    longitud = Column(Numeric(9, 6), nullable=False)
    precision_m = Column(Float, nullable=True)
    velocidad_m_s = Column(Float, nullable=True)
    rumbo_grados = Column(Float, nullable=True)
    registrada_en = Column(DateTime, nullable=False)
    recibida_en = Column(DateTime, nullable=True)
