from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ViajeAsignarRequest(BaseModel):
    entrega_ids: list[UUID] = Field(min_length=1, max_length=50)
    vehiculo_id: int = Field(gt=0)
    conductor_id: int = Field(gt=0)
    cooperativa_id: int = Field(gt=0)


class CargaViajeResponse(BaseModel):
    id_entrega: UUID
    caficultor_nombre: str
    cantidad_kg: float
    estado_entrega: str
    carga_recogida_en: Optional[datetime] = None
    orden_recoleccion: int


class ViajeResponse(BaseModel):
    id_viaje: UUID
    estado_viaje: Literal["asignado", "en_cola", "en_camino", "completado", "cancelado"]
    orden_cola: int
    vehiculo_id: int
    vehiculo_placa: str
    conductor_id: int
    conductor_nombre: str
    cooperativa_nombre: str
    peso_total_kg: float
    puede_iniciar: bool
    creado_en: datetime
    iniciado_en: Optional[datetime] = None
    completado_en: Optional[datetime] = None
    cargas: list[CargaViajeResponse]
