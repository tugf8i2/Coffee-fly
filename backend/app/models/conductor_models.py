from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Conductor(Base):
    __tablename__ = "conductor"
    __table_args__ = {"schema": "public"}

    id_conductor = Column(Integer, primary_key=True)
    licencia = Column(String(20), nullable=False)
    foto_licencia = Column(String, nullable=True)
    usuario_id = Column(Integer,ForeignKey("public.usuario.id_usuario"),nullable=False,unique=True)

    # Relación 1 - 1 con Usuario
    usuarios = relationship("Usuario", back_populates="conductor")
    vehiculos = relationship("Vehiculo", back_populates="conductor")
