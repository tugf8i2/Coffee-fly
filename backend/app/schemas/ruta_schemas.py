from pydantic import BaseModel
from typing import Optional


class RutaBase(BaseModel):
    nombre_ruta: str
    descripcion_recorrido: Optional[str] = None
    distancia_estimada: Optional[float] = None
    tiempo_estimado_horas: Optional[float] = None
    cooperativa_id: Optional[int] = None

class RutaCreate(RutaBase):
    pass

class RutaUpdate(BaseModel):
    nombre_ruta: Optional[str] = None
    descripcion_recorrido: Optional[str] = None
    distancia_estimada: Optional[float] = None
    tiempo_estimado_horas: Optional[float] = None
    cooperativa_id: Optional[int] = None


class RutaResponse(RutaBase):
    id_ruta: int

    class Config:
        from_attributes = True