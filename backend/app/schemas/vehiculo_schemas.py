from pydantic import BaseModel
from typing import Literal, Optional


class VehiculoBase(BaseModel):
    placa: str
    tipo_vehiculo: str
    modelo: Optional[str] = None
    capacidad_kg: float

    estado_vehiculo: Optional[
        Literal[
            "disponible",
            "en camino",
            "en mantenimiento"
        ]
    ] = None

    conductor_id: Optional[int] = None




class VehiculoCreate(VehiculoBase):
    pass



class VehiculoUpdate(BaseModel):
    placa: Optional[str] = None
    tipo_vehiculo: Optional[str] = None
    modelo: Optional[str] = None
    capacidad_kg: Optional[float] = None
    estado_vehiculo: Optional[
        Literal[
            "disponible",
            "en camino",
            "en mantenimiento"
        ]
    ] = None

    conductor_id: Optional[int] = None



class VehiculoResponse(VehiculoBase):
    id_vehiculo: int
    class Config:
        from_attributes = True
