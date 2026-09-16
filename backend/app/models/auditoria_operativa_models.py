from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, JSON, String

from app.core.database import Base


class AuditoriaOperativa(Base):
    __tablename__ = "auditoria_operativa"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entidad = Column(String(30), nullable=False)
    entidad_id = Column(String(50), nullable=False)
    accion = Column(String(30), nullable=False)
    usuario_id = Column(ForeignKey("usuario.id_usuario"), nullable=True)
    antes = Column(JSON, nullable=True)
    despues = Column(JSON, nullable=True)
    creado_en = Column(DateTime, nullable=False)
