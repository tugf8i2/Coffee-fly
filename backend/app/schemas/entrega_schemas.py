from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EntregaCreate(BaseModel):
    solicitud_id: UUID
    fecha_hora_entrega: datetime
    observaciones: Optional[str] = Field(default=None, max_length=500)


class EntregaResponse(BaseModel):
    id_entrega: UUID
    solicitud_id: UUID
    caficultor_id: int
    cantidad_kg: float
    fecha_hora_entrega: datetime
    observaciones: Optional[str] = None
    estado_entrega: str

    class Config:
        from_attributes = True


class ActualizarEstadoEntregaRequest(BaseModel):
    estado_entrega: Literal["pendiente", "en camino", "entregado", "cancelado"]


class HistorialEstadoEntregaResponse(BaseModel):
    id_historial: UUID
    estado_anterior: str
    estado_nuevo: str
    usuario_id: int
    usuario_nombre: str
    fecha_hora_cambio: datetime


class EntregaAsignadaResponse(EntregaResponse):
    caficultor_nombre: str
    vehiculo_placa: str


class SolicitudActivaEntregaResponse(BaseModel):
    id_solicitud: UUID
    caficultor_id: int
    caficultor_nombre: str
    fecha_hora_solicitud: datetime
    cantidad_solicitada_kg: float


class AsignarVehiculoRequest(BaseModel):
    vehiculo_id: int = Field(gt=0)
    conductor_id: int = Field(gt=0)


class EntregaPendienteAsignacionResponse(BaseModel):
    id_entrega: UUID
    caficultor_nombre: str
    cantidad_kg: float
    fecha_hora_entrega: datetime
    observaciones: Optional[str] = None


class VehiculoDisponibleResponse(BaseModel):
    id_vehiculo: int
    placa: str
    tipo_vehiculo: str
    modelo: Optional[str] = None
    capacidad_kg: float
    carga_actual_kg: float
    capacidad_disponible_kg: float


class ConductorDisponibleResponse(BaseModel):
    id_conductor: Optional[int] = None
    nombre_conductor: str
    licencia: Optional[str] = None
    tiene_foto_licencia: bool = False


class HistorialAsignacionResponse(BaseModel):
    id_asignacion: UUID
    entrega_id: UUID
    caficultor_nombre: str
    cantidad_kg: float
    vehiculo_placa: str
    conductor_nombre: str
    coordinador_nombre: str
    fecha_hora_asignacion: datetime
