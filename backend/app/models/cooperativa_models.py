from sqlalchemy import UUID, Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Cooperativa(Base):
    __tablename__ = "cooperativa"
    id_cooperativa = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False)
    telefono = Column(String(10), nullable=False)
    correo = Column(String(50), nullable=False)

    ubicacion_id = Column(UUID(as_uuid=True), ForeignKey("ubicacion.id_ubicacion"), nullable=False)

    ubicacion = relationship("Ubicacion")

    rutas = relationship("Ruta", back_populates="cooperativa")
    cargas = relationship("Carga", back_populates="cooperativa")
