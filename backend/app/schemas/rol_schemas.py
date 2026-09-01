from pydantic import BaseModel, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)
