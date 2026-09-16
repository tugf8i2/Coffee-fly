from sqlalchemy import Boolean, Column, Float, Integer, String

from app.core.database import Base


class ConfiguracionVehicular(Base):
    __tablename__ = "configuracion_vehicular"

    codigo = Column(String(12), primary_key=True)
    descripcion = Column(String(120), nullable=False)
    clase_vehiculo = Column(String(40), nullable=False)
    numero_ejes = Column(Integer, nullable=True)
    pbv_maximo_legal_kg = Column(Float, nullable=True)
    licencia_particular = Column(String(2), nullable=False)
    licencia_publico = Column(String(2), nullable=False)
    activo = Column(Boolean, nullable=False, default=True)
