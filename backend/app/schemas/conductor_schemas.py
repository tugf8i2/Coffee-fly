from pydantic import BaseModel, ConfigDict
from typing import Optional


class ConductorBase(BaseModel):
    licencia: str
    foto_licencia: Optional[str] = None
    usuario_id: int

class ConductorCreate(ConductorBase):
    pass

class ConductorUpdate(BaseModel):
    licencia: Optional[str] = None
    foto_licencia: Optional[str] = None
    usuario_id: Optional[int] = None

class ConductorResponse(BaseModel):
    id_conductor: int
    licencia: str
    foto_licencia: Optional[str] = None
    usuario_id: int

    model_config = ConfigDict(from_attributes=True)

