from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def validar_anio_modelo(value: str | None) -> str | None:
    if value is None:
        return value
    normalized = str(value).strip()
    if not normalized.isdigit() or len(normalized) != 4 or int(normalized) < 2000:
        raise ValueError("El año debe ser igual o posterior a 2000")
    return normalized


class VehiculoBase(BaseModel):
    placa: str = Field(min_length=5, max_length=7)
    tipo_vehiculo: str = Field(min_length=3, max_length=30)
    modelo: str | None = None  # Año de modelo heredado.
    marca: str | None = Field(default=None, max_length=60)
    modelo_comercial: str | None = Field(default=None, max_length=60)
    color: str | None = Field(default=None, max_length=40)
    tipo_servicio: Literal["PARTICULAR", "PUBLICO"]
    configuracion: str = Field(min_length=2, max_length=12)
    numero_ejes: int | None = Field(default=None, ge=2, le=9)
    tipo_carroceria: str | None = Field(default=None, max_length=60)
    tara_kg: float = Field(gt=0)
    pbv_homologado_kg: float = Field(gt=0)
    soat_vencimiento: date
    tecnomecanica_vencimiento: date
    seguro_vencimiento: date
    cooperativa_id: int | None = Field(default=None, gt=0)
    estado_vehiculo: Literal["disponible", "en mantenimiento", "inactivo"] = "disponible"
    model_config = ConfigDict(extra="forbid")

    @field_validator("modelo")
    @classmethod
    def validar_modelo(cls, value):
        return validar_anio_modelo(value)


class VehiculoCreate(VehiculoBase):
    pass


class VehiculoUpdate(BaseModel):
    placa: str | None = Field(default=None, min_length=5, max_length=7)
    tipo_vehiculo: str | None = Field(default=None, min_length=3, max_length=30)
    modelo: str | None = None
    marca: str | None = Field(default=None, max_length=60)
    modelo_comercial: str | None = Field(default=None, max_length=60)
    color: str | None = Field(default=None, max_length=40)
    tipo_servicio: Literal["PARTICULAR", "PUBLICO"] | None = None
    configuracion: str | None = Field(default=None, max_length=12)
    numero_ejes: int | None = Field(default=None, ge=2, le=9)
    tipo_carroceria: str | None = Field(default=None, max_length=60)
    tara_kg: float | None = Field(default=None, gt=0)
    pbv_homologado_kg: float | None = Field(default=None, gt=0)
    soat_vencimiento: date | None = None
    tecnomecanica_vencimiento: date | None = None
    seguro_vencimiento: date | None = None
    cooperativa_id: int | None = Field(default=None, gt=0)
    estado_vehiculo: Literal["disponible", "en mantenimiento", "inactivo"] | None = None
    model_config = ConfigDict(extra="forbid")

    @field_validator("modelo")
    @classmethod
    def validar_modelo(cls, value):
        return validar_anio_modelo(value)


class VehiculoResponse(BaseModel):
    id_vehiculo: int
    placa: str
    tipo_vehiculo: str
    modelo: str | None = None
    marca: str | None = None
    modelo_comercial: str | None = None
    color: str | None = None
    clase_vehiculo: str | None = None
    tipo_servicio: str | None = None
    configuracion: str | None = None
    numero_ejes: int | None = None
    tipo_carroceria: str | None = None
    tara_kg: float | None = None
    pbv_homologado_kg: float | None = None
    pbv_maximo_legal_kg: float | None = None
    capacidad_kg: float
    licencia_minima_requerida: str | None = None
    estado_vehiculo: str | None = None
    conductor_id: int | None = None
    soat_vencimiento: date | None = None
    tecnomecanica_vencimiento: date | None = None
    seguro_vencimiento: date | None = None
    cooperativa_id: int | None = None
    creado_en: datetime | None = None
    actualizado_en: datetime | None = None
    documentacion_completa: bool = False
    model_config = ConfigDict(from_attributes=True)


class ConfiguracionVehicularResponse(BaseModel):
    codigo: str
    descripcion: str
    clase_vehiculo: str
    numero_ejes: int | None
    pbv_maximo_legal_kg: float | None
    licencia_particular: str
    licencia_publico: str
    activo: bool
    model_config = ConfigDict(from_attributes=True)


class ConfiguracionVehicularUpdate(BaseModel):
    descripcion: str = Field(min_length=3, max_length=120)
    pbv_maximo_legal_kg: float | None = Field(default=None, gt=0)
    licencia_particular: Literal["B1", "B2", "B3"]
    licencia_publico: Literal["C1", "C2", "C3"]
    activo: bool = True
