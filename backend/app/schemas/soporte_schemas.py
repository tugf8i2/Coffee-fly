from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MensajeSoporteCreate(BaseModel):
    mensaje: str = Field(min_length=1, max_length=800)


class MensajeSoporteResponse(BaseModel):
    id_mensaje: UUID
    entrega_id: UUID
    remitente_id: int | None
    remitente_nombre: str
    mensaje: str
    fecha_hora: datetime
    leido: bool
    es_propio: bool


class ConversacionSoporteResponse(BaseModel):
    entrega_id: UUID
    carga_id: UUID
    estado_entrega: str
    cantidad_kg: float
    caficultor_nombre: str
    coordinador_nombre: str
    fecha_asignacion: datetime
    ultimo_mensaje: str | None = None
    ultimo_mensaje_en: datetime | None = None
    mensajes_no_leidos: int = 0
