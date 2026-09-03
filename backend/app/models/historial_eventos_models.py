from sqlalchemy import UUID, Column, DateTime, String, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.config import EVENT_RETENTION_DAYS
from app.core.time import utc_now_naive
import uuid
from datetime import timedelta


class HistorialEvento(Base):
    __tablename__ = "historial_de_eventos"
    __table_args__ = (
        Index("ix_historial_eventos_entrega_fecha", "entrega_id", "fecha_hora_evento"),
        Index("ix_historial_eventos_tipo", "tipo_evento"),
        Index("ix_historial_eventos_expira", "expira_en"),
    )
    id_evento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)


    carga_id = Column(UUID(as_uuid=True), ForeignKey("carga.id_carga"), nullable=False)
    entrega_id = Column(UUID(as_uuid=True), ForeignKey("entrega.id_entrega"))
    tipo_evento = Column(String(30), nullable=False, default="inconveniente")
    descripcion_evento = Column(String(300), nullable=False)

    fecha_hora_evento = Column(DateTime, nullable=False)
    fecha_hora_sincronizacion = Column(DateTime, nullable=False)
    expira_en = Column(
        DateTime,
        nullable=False,
        default=lambda: utc_now_naive() + timedelta(days=EVENT_RETENTION_DAYS),
    )

    ubicacion_id = Column(UUID(as_uuid=True), ForeignKey("ubicacion.id_ubicacion"))
    conductor_id = Column(Integer, ForeignKey("conductor.id_conductor"))
    usuario_id_cambio = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
