from datetime import datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


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

    model_config = ConfigDict(from_attributes=True)


class ActualizarEstadoEntregaRequest(BaseModel):
    estado_entrega: Literal["pendiente", "en camino", "entregado", "cancelado"]
    modificado_en: Optional[datetime] = None


class HistorialEstadoEntregaResponse(BaseModel):
    id_historial: UUID
    estado_anterior: str
    estado_nuevo: str
    usuario_id: int
    usuario_nombre: str
    fecha_hora_cambio: datetime


class HistorialEstadoEntregaLoteResponse(HistorialEstadoEntregaResponse):
    entrega_id: UUID


class EntregaAsignadaResponse(EntregaResponse):
    caficultor_nombre: str
    vehiculo_placa: str


class ReportarEventoConductorRequest(BaseModel):
    tipo_evento: Literal["daño vehicular", "parada baño", "imprevisto nuevo"]
    detalle: Optional[str] = Field(default=None, max_length=75)


class EventoConductorResponse(BaseModel):
    id_evento: UUID
    descripcion_evento: str
    fecha_hora_evento: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificacionEventoResponse(EventoConductorResponse):
    entrega_id: UUID
    carga_id: UUID
    carga_peso_kg: float
    caficultor_nombre: str
    vehiculo_placa: Optional[str] = None
    conductor_nombre: str


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


class EntregaHistorialItem(EntregaResponse):
    caficultor_nombre: str
    vehiculo_id: Optional[int] = None
    vehiculo_placa: Optional[str] = None


class EntregaHistorialPagina(BaseModel):
    items: list[EntregaHistorialItem]
    total: int
    pagina: int
    tamano_pagina: int


class RegistrarUbicacionRequest(BaseModel):
    client_point_id: UUID = Field(default_factory=uuid4)
    latitud: float = Field(ge=-90, le=90)
    longitud: float = Field(ge=-180, le=180)
    precision_m: Optional[float] = Field(default=None, ge=0, le=10000)
    velocidad_m_s: Optional[float] = Field(default=None, ge=0, le=200)
    rumbo_grados: Optional[float] = Field(default=None, ge=0, le=360)
    capturada_en: Optional[datetime] = None


class RegistrarUbicacionResponse(BaseModel):
    estado: Literal["guardado", "duplicado"]
    id_ubicacion: UUID
    client_point_id: UUID
    registrada_en: datetime
    distancia_recorrida_m: float = 0


class SincronizarUbicacionesRequest(BaseModel):
    puntos: list[RegistrarUbicacionRequest] = Field(min_length=1, max_length=200)


class ResultadoSincronizacionPunto(BaseModel):
    client_point_id: UUID
    estado: Literal["guardado", "duplicado", "rechazado"]
    id_ubicacion: Optional[UUID] = None
    registrada_en: Optional[datetime] = None
    distancia_recorrida_m: float = 0
    detalle: Optional[str] = None


class SincronizarUbicacionesResponse(BaseModel):
    recibidos: int
    guardados: int
    duplicados: int
    rechazados: int
    resultados: list[ResultadoSincronizacionPunto]
    distancia_recorrida_m: float = 0


class PuntoRutaResponse(BaseModel):
    client_point_id: Optional[UUID] = None
    latitud: float
    longitud: float
    registrada_en: datetime
    precision_m: Optional[float] = None
    velocidad_m_s: Optional[float] = None
    rumbo_grados: Optional[float] = None


class SeguimientoEntregaResponse(BaseModel):
    entrega_id: UUID
    estado_entrega: str
    vehiculo_id: int
    vehiculo_placa: str
    destino: Optional[str] = None
    destino_latitud: Optional[float] = None
    destino_longitud: Optional[float] = None
    destino_actualizado_en: Optional[datetime] = None
    total_puntos: int = 0
    ruta_truncada: bool = False
    distancia_recorrida_m: float = 0
    puntos: list[PuntoRutaResponse]
