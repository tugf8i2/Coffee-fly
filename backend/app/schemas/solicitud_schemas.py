from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime


class SolicitudBase(BaseModel):

    estado_solicitud: Literal[
        "pendiente",
        "en camino",
        "entregado",
        "cancelado"
    ]

    fecha_hora_solicitud: datetime

    caficultor_id: Optional[int] = None
    carga_id: Optional[UUID] = None


class SolicitudCreate(SolicitudBase):
    pass


class SolicitudUpdate(BaseModel):

    estado_solicitud: Optional[
        Literal[
            "pendiente",
            "en camino",
            "entregado",
            "cancelado"
        ]
    ] = None

    fecha_hora_solicitud: Optional[datetime] = None

    caficultor_id: Optional[int] = None
    carga_id: Optional[UUID] = None

    estado_sincronizacion: Optional[str] = None



class SolicitudResponse(SolicitudBase):

    id_solicitud: UUID

    estado_sincronizacion: str

    model_config = ConfigDict(from_attributes=True)


class SincronizarSolicitudRequest(BaseModel):
    client_request_id: UUID
    peso_kg: float = Field(gt=0, le=999999.99)
    observacion: str = Field(default="", max_length=100)
    capturada_en: datetime


class SincronizarSolicitudResponse(BaseModel):
    client_request_id: UUID
    solicitud_id: UUID
    carga_id: UUID
    estado: Literal["registrada", "duplicada"]
