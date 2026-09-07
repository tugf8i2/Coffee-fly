from pydantic import BaseModel, ConfigDict, Field, model_validator
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
    peso_total_kg: Optional[float] = None
    peso_bulto_kg: Optional[float] = None
    cantidad_bultos: Optional[int] = None
    peso_extra_kg: Optional[float] = None
    grupos_bultos: Optional[list[dict]] = None

    model_config = ConfigDict(from_attributes=True)


class SincronizarSolicitudRequest(BaseModel):
    client_request_id: UUID
    peso_bulto_kg: Optional[float] = Field(default=None, gt=0, le=9999.99)
    cantidad_bultos: Optional[int] = Field(default=None, gt=0, le=99999)
    peso_extra_kg: float = Field(default=0, ge=0, le=9999.99)
    # Se acepta temporalmente para sincronizar solicitudes antiguas que ya
    # estaban guardadas sin conexión antes de incorporar el detalle por bulto.
    peso_kg: Optional[float] = Field(default=None, gt=0, le=999999.99)
    grupos_bultos: Optional[list[dict]] = None
    observacion: str = Field(default="", max_length=100)
    capturada_en: datetime

    @model_validator(mode="after")
    def validar_detalle(self):
        if self.grupos_bultos:
            for grupo in self.grupos_bultos:
                peso = grupo.get("peso_bulto_kg")
                cantidad = grupo.get("cantidad_bultos")
                if not isinstance(peso, (int, float)) or peso <= 0 or peso > 9999.99:
                    raise ValueError("Cada grupo debe tener un peso por bulto válido")
                if not isinstance(cantidad, int) or cantidad <= 0 or cantidad > 99999:
                    raise ValueError("Cada grupo debe tener una cantidad entera de bultos")
            if self.peso_total_kg > 999999.99:
                raise ValueError("El peso total supera el máximo permitido")
            return self
        if self.peso_kg is None and (self.peso_bulto_kg is None or self.cantidad_bultos is None):
            raise ValueError("Debes indicar el peso por bulto y la cantidad de bultos")
        if self.peso_total_kg > 999999.99:
            raise ValueError("El peso total supera el máximo permitido")
        return self

    @property
    def peso_total_kg(self) -> float:
        if self.grupos_bultos:
            return round(sum(grupo["peso_bulto_kg"] * grupo["cantidad_bultos"] for grupo in self.grupos_bultos), 2)
        if self.peso_kg is not None:
            return round(self.peso_kg, 2)
        return round((self.peso_bulto_kg * self.cantidad_bultos) + self.peso_extra_kg, 2)


class SincronizarSolicitudResponse(BaseModel):
    client_request_id: UUID
    solicitud_id: UUID
    carga_id: UUID
    estado: Literal["registrada", "duplicada"]
