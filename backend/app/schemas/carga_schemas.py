from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class CargaBase(BaseModel):
    peso_kg: float
    descripcion: Optional[str] = None

    vehiculo_id: Optional[int] = None
    cooperativa_id: Optional[int] = None
    ruta_id: Optional[int] = None


class CargaCreate(CargaBase):
    pass


class CargaUpdate(BaseModel):
    peso_kg: Optional[float] = None
    descripcion: Optional[str] = None

    vehiculo_id: Optional[int] = None
    cooperativa_id: Optional[int] = None
    ruta_id: Optional[int] = None

    estado_sincronizacion: Optional[str] = None


class CargaResponse(CargaBase):
    id_carga: UUID
    estado_sincronizacion: str
    actualizado_en: Optional[datetime] = None

    class Config:
        from_attributes = True