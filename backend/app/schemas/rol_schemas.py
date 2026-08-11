from pydantic import BaseModel
from typing import Optional


class RolBase(BaseModel):
    descripcion_rol: str

class RolCreate(RolBase):
    pass

class RolUpdate(BaseModel):
    descripcion_rol: Optional[str] = None

class RolResponse(BaseModel):
    id_rol: int
    descripcion_rol: str

    class Config:
        from_attributes = True