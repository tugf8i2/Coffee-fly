from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EntregaCreate(BaseModel):
    solicitud_id: UUID
    cantidad_kg: float = Field(gt=0)
    fecha_hora: datetime
    observaciones: Optional[str] = Field(default=None, max_length=100)


class EntregaResponse(BaseModel):
    id_entrega: UUID
    solicitud_id: UUID
    caficultor_id: int
    caficultor_nombre: Optional[str] = None
    cantidad_kg: float
    fecha_hora: datetime
    observaciones: Optional[str] = None
    estado_entrega: str

    class Config:
        from_attributes = True
