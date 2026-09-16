from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConductorBase(BaseModel):
    licencia: str = Field(max_length=2)
    foto_licencia: str | None = None
    usuario_id: int
    numero_licencia: str | None = Field(default=None, max_length=40)
    fecha_expedicion_licencia: date | None = None
    fecha_vencimiento_licencia: date | None = None
    estado_conductor: Literal["disponible", "descanso", "inactivo", "bloqueado"] | None = None
    cooperativa_id: int | None = None


class ConductorCreate(ConductorBase):
    pass


class ConductorUpdate(BaseModel):
    licencia: str | None = None
    foto_licencia: str | None = None
    usuario_id: int | None = None
    numero_licencia: str | None = None
    fecha_expedicion_licencia: date | None = None
    fecha_vencimiento_licencia: date | None = None
    estado_conductor: Literal["disponible", "descanso", "inactivo", "bloqueado"] | None = None
    cooperativa_id: int | None = None


class ConductorResponse(ConductorBase):
    id_conductor: int
    estado_conductor: str | None = None
    estado_licencia: str
    model_config = ConfigDict(from_attributes=True)
