from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


CODIGOS_INSPECCION = ("aceite", "llantas", "frenos", "luces", "documentos", "seguridad")


class InspeccionItem(BaseModel):
    codigo: Literal["aceite", "llantas", "frenos", "luces", "documentos", "seguridad"]
    estado: Literal["bien", "novedad"]
    observacion: str = Field(default="", max_length=300)
    foto_evidencia: str | None = Field(default=None, max_length=3_000_000)

    @field_validator("observacion")
    @classmethod
    def normalizar_observacion(cls, value):
        return value.strip()

    @field_validator("foto_evidencia")
    @classmethod
    def validar_foto(cls, value):
        if value is not None and not value.startswith(("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")):
            raise ValueError("La evidencia debe ser una imagen válida")
        return value


class InspeccionVehiculoCreate(BaseModel):
    client_inspection_id: UUID
    vehiculo_id: int = Field(gt=0)
    viaje_id: UUID
    capturada_en: datetime
    items: list[InspeccionItem] = Field(min_length=6, max_length=6)

    @field_validator("items")
    @classmethod
    def validar_items(cls, items):
        codes = [item.codigo for item in items]
        if len(set(codes)) != len(CODIGOS_INSPECCION) or set(codes) != set(CODIGOS_INSPECCION):
            raise ValueError("La inspección debe incluir los seis puntos de seguridad sin repetir")
        for item in items:
            if item.estado == "novedad" and not item.observacion and not item.foto_evidencia:
                raise ValueError(f"Describe o fotografía la novedad de {item.codigo}")
        return items


class InspeccionVehiculoResponse(BaseModel):
    id_inspeccion: UUID
    client_inspection_id: UUID
    vehiculo_id: int
    conductor_id: int
    viaje_id: UUID
    estado_general: str
    items: list[InspeccionItem]
    capturada_en: datetime
    sincronizada_en: datetime
    model_config = ConfigDict(from_attributes=True)
