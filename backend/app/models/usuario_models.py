from sqlalchemy import Boolean, Column, DateTime, Float, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True)
    nombre_usuario = Column(String(30), nullable=False)
    apellido = Column(String(30), nullable=False)
    correo_usuario = Column(String(30), nullable=False, unique=True)
    telefono_usuario = Column(String(10), nullable=False)
    contrasena = Column(String(255), nullable=False)
    habilitado = Column(Boolean, nullable=False, default=True, server_default="true")
    intentos_fallidos = Column(Integer, nullable=False, default=0, server_default="0")
    bloqueado_hasta = Column(DateTime(timezone=True), nullable=True)
    departamento = Column(String(100), nullable=True)
    municipio = Column(String(100), nullable=True)
    vereda = Column(String(100), nullable=True)
    # Coordenadas de la finca, capturadas por el propio caficultor. No se
    # exponen en los listados generales de usuarios.
    latitud_finca = Column(Float, nullable=True)
    longitud_finca = Column(Float, nullable=True)
    ubicacion_finca_actualizada_en = Column(DateTime, nullable=True)

    rol_id = Column(Integer, ForeignKey("rol.id_rol"))
    rol = relationship("Rol", back_populates="usuarios")
    conductor = relationship("Conductor", back_populates="usuarios", uselist=False)
