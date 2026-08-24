from sqlalchemy import Column, Float, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Vehiculo(Base):
    __tablename__ = "vehiculo"
    __table_args__ = {"schema": "public"}

    id_vehiculo = Column(Integer, primary_key=True)
    placa = Column(String(7), nullable=False)
    tipo_vehiculo = Column(String(30), nullable=False)
    modelo = Column(String(50), nullable=True)
    capacidad_kg = Column(Float, nullable=False)
    estado_vehiculo = Column(String(20))

    conductor_id = Column(Integer, ForeignKey("public.conductor.id_conductor"))

    conductor = relationship("Conductor", back_populates="vehiculos")

    cargas = relationship("Carga", back_populates="vehiculo")
