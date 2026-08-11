from pydantic import BaseModel
from typing import Optional


class ConductorBase(BaseModel):
    numero_licencia: str
    licencia: str
    usuario_id: int

class ConductorCreate(ConductorBase):
    pass

class ConductorUpdate(BaseModel):
    numero_licencia: Optional[str] = None
    licencia: Optional[str] = None
    usuario_id: Optional[int] = None

class ConductorResponse(BaseModel):
    id_conductor: int
    numero_licencia: str
    licencia: str
    usuario_id: int

    class Config:
        from_attributes = True

