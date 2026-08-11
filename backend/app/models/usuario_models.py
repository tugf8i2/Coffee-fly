from sqlalchemy import Column, String, Integer, ForeignKey 
from sqlalchemy.orm import relationship
from app.core.database import Base

class Usuario(Base):
    __tablename__ = "usuario"
    __table_args__ = {"schema": "public"}


    id_usuario = Column(Integer, primary_key=True)
    nombre_usuario = Column(String(30), nullable=False)
    apellido = Column(String(30), nullable=False)
    correo_usuario = Column(String(30), nullable=False, unique=True)
    telefono_usuario = Column(String(10), nullable=False)
    contrasena = Column(String(255), nullable=False)

    rol_id = Column(Integer, ForeignKey("public.rol.id_rol"))
    rol = relationship("Rol", back_populates="usuarios")
    conductor = relationship("Conductor", back_populates="usuarios", uselist=False)