from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.models.usuario_models import Usuario
from app.schemas.soporte_schemas import ConversacionSoporteResponse, MensajeSoporteCreate, MensajeSoporteResponse
from app.services.soporte_services import SoporteService


router = APIRouter(prefix="/soporte", tags=["Servicio al cliente"])


@router.get("/conversaciones", response_model=list[ConversacionSoporteResponse])
def listar_conversaciones(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("caficultor", "coordinador")),
):
    return SoporteService(db).listar_conversaciones(usuario)


@router.get("/conversaciones/{entrega_id}/mensajes", response_model=list[MensajeSoporteResponse])
def listar_mensajes(
    entrega_id: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("caficultor", "coordinador")),
):
    return SoporteService(db).listar_mensajes(entrega_id, usuario)


@router.post("/conversaciones/{entrega_id}/mensajes", response_model=MensajeSoporteResponse, status_code=201)
def enviar_mensaje(
    entrega_id: UUID,
    datos: MensajeSoporteCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("caficultor", "coordinador")),
):
    return SoporteService(db).enviar_mensaje(entrega_id, datos, usuario)
