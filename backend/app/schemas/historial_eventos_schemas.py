from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class HistorialEventoBase(BaseModel):

    carga_id: UUID

    descripcion_evento: str

    fecha_hora_evento: datetime

    fecha_hora_sincronizacion: datetime

    ubicacion_id: Optional[UUID] = None

    conductor_id: Optional[int] = None

    usuario_id_cambio: int


class HistorialEventoCreate(HistorialEventoBase):
    pass


class HistorialEventoUpdate(BaseModel):

    carga_id: Optional[UUID] = None

    descripcion_evento: Optional[str] = None

    fecha_hora_evento: Optional[datetime] = None

    fecha_hora_sincronizacion: Optional[datetime] = None

    ubicacion_id: Optional[UUID] = None

    conductor_id: Optional[int] = None

    usuario_id_cambio: Optional[int] = None


class HistorialEventoResponse(HistorialEventoBase):

    id_evento: UUID

    class Config:
        from_attributes = True