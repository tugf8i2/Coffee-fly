from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.models.usuario_models import Usuario
from app.schemas.viaje_schemas import ViajeAsignarRequest, ViajeResponse
from app.services.viaje_services import ViajeService


router = APIRouter(prefix="/viajes", tags=["Viajes"])


def _perfil_conductor(usuario):
    if usuario.conductor is None:
        raise HTTPException(status_code=403, detail="El usuario no tiene perfil de conductor")
    return usuario.conductor.id_conductor


@router.post("/", response_model=ViajeResponse, status_code=201)
def asignar_viaje(datos: ViajeAsignarRequest, db: Session = Depends(get_db), coordinador: Usuario = Depends(require_roles("coordinador"))):
    return ViajeService(db).asignar(datos, coordinador.id_usuario)


@router.get("/mis-asignados", response_model=list[ViajeResponse])
def mis_viajes_asignados(db: Session = Depends(get_db), conductor: Usuario = Depends(require_roles("conductor"))):
    return ViajeService(db).listar_conductor(_perfil_conductor(conductor))


@router.get("/mi-activo", response_model=list[ViajeResponse])
def mi_viaje_activo(db: Session = Depends(get_db), conductor: Usuario = Depends(require_roles("conductor"))):
    return ViajeService(db).listar_conductor(_perfil_conductor(conductor), activos=True)


@router.post("/{viaje_id}/iniciar", response_model=ViajeResponse)
def iniciar_viaje(viaje_id: UUID, db: Session = Depends(get_db), conductor: Usuario = Depends(require_roles("conductor"))):
    return ViajeService(db).iniciar(viaje_id, _perfil_conductor(conductor), conductor.id_usuario)


@router.post("/{viaje_id}/completar", response_model=ViajeResponse)
def completar_viaje(viaje_id: UUID, db: Session = Depends(get_db), conductor: Usuario = Depends(require_roles("conductor"))):
    return ViajeService(db).completar(viaje_id, _perfil_conductor(conductor), conductor.id_usuario)
