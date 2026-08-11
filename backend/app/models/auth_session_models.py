from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base


class AuthSession(Base):
    __tablename__ = "auth_session"
    __table_args__ = {"schema": "public"}

    token = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("public.usuario.id_usuario"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
