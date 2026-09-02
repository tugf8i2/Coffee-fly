from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID

class UbicacionBase(BaseModel):
    x: float = Field(ge=-180, le=180, description="Longitud")
    y: float = Field(ge=-90, le=90, description="Latitud")
    departamento: str = Field(min_length=2, max_length=50)
    ciudad: str = Field(min_length=2, max_length=50)
    direccion: str = Field(min_length=3, max_length=250)



class UbicacionCreate(UbicacionBase):
    pass


class UbicacionUpdate(BaseModel):
    x: Optional[float] = Field(default=None, ge=-180, le=180)
    y: Optional[float] = Field(default=None, ge=-90, le=90)
    departamento: Optional[str] = Field(default=None, min_length=2, max_length=50)
    ciudad: Optional[str] = Field(default=None, min_length=2, max_length=50)
    direccion: Optional[str] = Field(default=None, min_length=3, max_length=250)


class UbicacionResponse(UbicacionBase):
    id_ubicacion: UUID


    model_config = ConfigDict(from_attributes=True)
