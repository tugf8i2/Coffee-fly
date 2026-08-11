from sqlalchemy import UUID, Column, DateTime, Numeric, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from sqlalchemy.dialects.postgresql import UUID
import uuid

class Carga(Base):
    __tablename__ = "carga"
    __table_args__ = {"schema": "public"}

    id_carga = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,   # 👈 CLAVE
        nullable=False
    )

    peso_kg = Column(Numeric(8, 2))
    descripcion = Column(String(100))

    vehiculo_id = Column(Integer, ForeignKey("public.vehiculo.id_vehiculo"))
    cooperativa_id = Column(Integer, ForeignKey("public.cooperativa.id_cooperativa"))
    ruta_id = Column(Integer, ForeignKey("public.ruta.id_ruta"))

    estado_sincronizacion = Column(String(20), default="pendiente")
    actualizado_en = Column(DateTime)

    vehiculo = relationship("Vehiculo", back_populates="cargas")
    cooperativa = relationship("Cooperativa", back_populates="cargas")
    ruta = relationship("Ruta", back_populates="cargas")