from sqlalchemy import Column, Float, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Ruta(Base):
    __tablename__ = "ruta"
    __table_args__ = {"schema": "public"}

    id_ruta = Column(Integer, primary_key=True)
    nombre_ruta = Column(String(100), nullable=False)
    descripcion_recorrido = Column(Text)
    distancia_estimada = Column(Float)
    tiempo_estimado_horas = Column(Float)

    cooperativa_id = Column(Integer, ForeignKey("public.cooperativa.id_cooperativa"))

    cooperativa = relationship("Cooperativa", back_populates="rutas")
    
    cargas = relationship("Carga", back_populates="ruta")