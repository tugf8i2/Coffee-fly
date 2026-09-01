from sqlalchemy import UUID, Column, DateTime, Numeric, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from sqlalchemy.dialects.postgresql import UUID
import uuid

class Carga(Base):
    __tablename__ = "carga"
    id_carga = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,   # 👈 CLAVE
        nullable=False
    )

    peso_kg = Column(Numeric(8, 2))
    descripcion = Column(String(100))

    vehiculo_id = Column(Integer, ForeignKey("vehiculo.id_vehiculo"))
    cooperativa_id = Column(Integer, ForeignKey("cooperativa.id_cooperativa"))
    ruta_id = Column(Integer, ForeignKey("ruta.id_ruta"))
    caficultor_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True, index=True)

    estado_sincronizacion = Column(String(20), nullable=False, default="pendiente")
    actualizado_en = Column(DateTime)

    vehiculo = relationship("Vehiculo", back_populates="cargas")
    cooperativa = relationship("Cooperativa", back_populates="cargas")
    ruta = relationship("Ruta", back_populates="cargas")
    caficultor = relationship("Usuario")
