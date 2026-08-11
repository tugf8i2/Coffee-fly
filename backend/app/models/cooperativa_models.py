from sqlalchemy import UUID, Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Cooperativa(Base):
    __tablename__ = "cooperativa"
    __table_args__ = {"schema": "public"}

    id_cooperativa = Column(Integer, primary_key=True)
    nombre = Column(String(50))
    telefono = Column(String(10))
    correo = Column(String(50))

    ubicacion_id = Column(UUID(as_uuid=True), ForeignKey("public.ubicacion.id_ubicacion"))

    ubicacion = relationship("Ubicacion")

    rutas = relationship("Ruta", back_populates="cooperativa")
    cargas = relationship("Carga", back_populates="cooperativa")