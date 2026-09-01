from sqlalchemy import Column, Integer, String
from app.core.database import Base
from sqlalchemy.orm import relationship


class Rol(Base):

    __tablename__ = "rol"
    id_rol = Column(Integer,primary_key=True, autoincrement=True)  
    descripcion_rol = Column(String (200), nullable=False)

    usuarios = relationship("Usuario", back_populates="rol")
