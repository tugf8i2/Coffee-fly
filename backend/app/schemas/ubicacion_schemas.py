from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class UbicacionBase(BaseModel):
    x: float
    y: float
    departamento: str
    ciudad: str
    direccion: str



class UbicacionCreate(UbicacionBase):
    pass


class UbicacionUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    departamento: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None


class UbicacionResponse(UbicacionBase):
    id_ubicacion: UUID


    class Config:
        from_attributes = True