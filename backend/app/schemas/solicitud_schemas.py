from pydantic import BaseModel
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

    class Config:
        from_attributes = True