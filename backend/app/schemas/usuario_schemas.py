from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional


class UsuarioBase(BaseModel):
    nombre_usuario: str = Field(max_length=30)
    apellido: str = Field(max_length=30)
    correo_usuario: EmailStr = Field(max_length=30)
    telefono_usuario: str = Field(min_length=10, max_length=10)
    contrasena: str = Field(min_length=7, max_length=128)

    @field_validator("correo_usuario")
    @classmethod
    def validar_dominio_copyplay(cls, value):
        value = str(value).lower()
        if not value.endswith("@coffeefly.com"):
            raise ValueError("El correo debe usar el dominio @coffeeFly.com")
        return value

    @field_validator("telefono_usuario")
    @classmethod
    def validar_telefono(cls, value):
        if not value.isdigit():
            raise ValueError("El teléfono debe contener únicamente dígitos")
        if len(value) != 10:
            raise ValueError("El teléfono debe tener exactamente 10 dígitos")
        return value

    departamento: Optional[str] = None
    municipio: Optional[str] = None
    vereda: Optional[str] = None

    rol_id: Optional[int] = None
    licencia: Optional[str] = Field(default=None, max_length=20)
    foto_licencia: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioUpdate(BaseModel):
    nombre_usuario: Optional[str] = Field(default=None, max_length=30)
    apellido: Optional[str] = Field(default=None, max_length=30)
    correo_usuario: Optional[EmailStr] = Field(default=None, max_length=30)
    telefono_usuario: Optional[str] = Field(default=None, min_length=10, max_length=10)
    contrasena: Optional[str] = Field(default=None, min_length=7, max_length=128)

    @field_validator("correo_usuario")
    @classmethod
    def validar_dominio_copyplay(cls, value):
        value = str(value).lower()
        if not value.endswith("@coffeefly.com"):
            raise ValueError("El correo debe usar el dominio @coffeeFly.com")
        return value

    @field_validator("telefono_usuario")
    @classmethod
    def validar_telefono(cls, value):
        if not value.isdigit():
            raise ValueError("El teléfono debe contener únicamente dígitos")
        if len(value) != 10:
            raise ValueError("El teléfono debe tener exactamente 10 dígitos")
        return value

    departamento: Optional[str] = None
    municipio: Optional[str] = None
    vereda: Optional[str] = None

    rol_id: Optional[int] = None
    licencia: Optional[str] = Field(default=None, max_length=20)
    foto_licencia: Optional[str] = None

class UsuarioResponse(BaseModel):
    id_usuario: int
    nombre_usuario: str
    apellido: str
    correo_usuario: EmailStr
    telefono_usuario: str
    rol_id: int
    departamento: Optional[str] = None
    municipio: Optional[str] = None
    vereda: Optional[str] = None
    licencia: Optional[str] = None
    tiene_foto_licencia: bool = False


    class Config:
        from_attributes = True
