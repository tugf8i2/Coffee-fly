from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.ubicacion_schemas import UbicacionCreate, UbicacionResponse, UbicacionUpdate


class CooperativaBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    telefono: str = Field(min_length=10, max_length=10)
    correo: EmailStr = Field(max_length=50)

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, value: str):
        if not value.isdigit():
            raise ValueError("El teléfono debe contener exactamente 10 dígitos")
        return value


class CooperativaCreate(CooperativaBase):
    ubicacion: UbicacionCreate


class CooperativaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=50)
    telefono: Optional[str] = Field(default=None, min_length=10, max_length=10)
    correo: Optional[EmailStr] = Field(default=None, max_length=50)
    ubicacion: Optional[UbicacionUpdate] = None

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, value: str | None):
        if value is not None and not value.isdigit():
            raise ValueError("El teléfono debe contener exactamente 10 dígitos")
        return value


class CooperativaResponse(CooperativaBase):
    id_cooperativa: int
    ubicacion_id: UUID
    ubicacion: UbicacionResponse

    model_config = ConfigDict(from_attributes=True)
