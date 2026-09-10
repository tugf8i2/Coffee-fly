from pydantic import BaseModel, ConfigDict, field_validator
from typing import Literal, Optional


def validar_anio_modelo(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    normalized = str(value).strip()
    if not normalized.isdigit() or len(normalized) != 4 or int(normalized) < 2000:
        raise ValueError("El modelo debe ser un año igual o posterior a 2000")
    return normalized


class VehiculoBase(BaseModel):
    placa: str
    tipo_vehiculo: Literal["Camión", "Tractomula"]
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
    @field_validator("modelo")
    @classmethod
    def validar_modelo(cls, value):
        return validar_anio_modelo(value)



class VehiculoUpdate(BaseModel):
    placa: Optional[str] = None
    tipo_vehiculo: Optional[Literal["Camión", "Tractomula"]] = None
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

    @field_validator("modelo")
    @classmethod
    def validar_modelo(cls, value):
        return validar_anio_modelo(value)



class VehiculoResponse(VehiculoBase):
    id_vehiculo: int
    # Los registros históricos pueden conservar tipos anteriores al catálogo actual.
    tipo_vehiculo: str
    model_config = ConfigDict(from_attributes=True)
