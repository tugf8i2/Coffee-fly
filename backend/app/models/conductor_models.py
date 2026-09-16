from sqlalchemy import Column, Date, DateTime, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta, timezone
from app.core.database import Base


class Conductor(Base):
    __tablename__ = "conductor"
    id_conductor = Column(Integer, primary_key=True)
    licencia = Column(String(20), nullable=False)
    foto_licencia = Column(String, nullable=False)
    usuario_id = Column(Integer,ForeignKey("usuario.id_usuario"),nullable=False,unique=True)
    numero_licencia = Column(String(40), nullable=True)
    fecha_expedicion_licencia = Column(Date, nullable=True)
    fecha_vencimiento_licencia = Column(Date, nullable=True)
    estado_conductor = Column(String(20), nullable=True)
    cooperativa_id = Column(Integer, ForeignKey("cooperativa.id_cooperativa"), nullable=True)
    actualizado_en = Column(DateTime, nullable=True)

    # Relación 1 - 1 con Usuario
    usuarios = relationship("Usuario", back_populates="conductor")
    vehiculos = relationship("Vehiculo", back_populates="conductor")

    @property
    def estado_licencia(self):
        if self.fecha_vencimiento_licencia is None:
            return "pendiente"
        hoy = datetime.now(timezone(timedelta(hours=-5))).date()
        return "vigente" if self.fecha_vencimiento_licencia >= hoy else "vencida"
