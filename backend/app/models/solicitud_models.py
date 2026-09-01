from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Solicitud(Base):
    __tablename__ = "solicitud"
    __table_args__ = (
        Index(
            "ux_solicitud_client_request_id",
            "client_request_id",
            unique=True,
            postgresql_where=text("client_request_id IS NOT NULL"),
        ),
    )
    id_solicitud = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    estado_solicitud = Column(String(20), nullable=False)
    fecha_hora_solicitud = Column(DateTime, nullable=False)

    estado_sincronizacion = Column(
    String(20),
    nullable=False,
    default="pendiente"
)

    caficultor_id = Column(Integer, ForeignKey("usuario.id_usuario"))
    carga_id = Column(UUID(as_uuid=True), ForeignKey("carga.id_carga"))
    client_request_id = Column(UUID(as_uuid=True), nullable=True)

    

    caficultor = relationship("Usuario")
    carga = relationship("Carga")
