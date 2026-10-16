from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuthSession(Base):
    __tablename__ = "auth_session"
    token = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    device_id = Column(String(80), nullable=True, index=True)
    device_name = Column(String(120), nullable=True)
    device_platform = Column(String(40), nullable=True)
    user_agent = Column(String(300), nullable=True)
    signed_in_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    user = relationship("Usuario")
