from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base


class AuthSession(Base):
    __tablename__ = "auth_session"
    token = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    device_id = Column(String(80), nullable=True, index=True)
    device_name = Column(String(120), nullable=True)
    platform = Column(String(30), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
