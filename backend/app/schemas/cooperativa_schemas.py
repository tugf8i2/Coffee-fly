from uuid import UUID 
from pydantic import BaseModel, ConfigDict
from typing import Optional

class CooperativaBase(BaseModel):
    nombre: str
    telefono: str
    correo: str
    ubicacion_id: Optional[UUID] 

class CooperativaCreate(CooperativaBase):
    pass

class CooperativaUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    ubicacion_id: Optional[UUID] = None

class CooperativaResponse(CooperativaBase):
    id_cooperativa: int

    model_config = ConfigDict(from_attributes=True)
