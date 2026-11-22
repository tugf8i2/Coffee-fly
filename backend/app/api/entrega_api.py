from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.models.usuario_models import Usuario
from app.schemas.entrega_schemas import EntregaCreate, EntregaResponse
from app.schemas.solicitud_schemas import SolicitudResponse
from app.services.entrega_services import EntregaService


router = APIRouter(prefix="/entregas", tags=["Entregas"])


@router.post("/", response_model=EntregaResponse, status_code=201)
def registrar_entrega(
    entrega: EntregaCreate,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).registrar(entrega)


@router.get("/hoy", response_model=list[EntregaResponse])
def listar_entregas_del_dia(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).listar_del_dia(fecha)


@router.get("/solicitudes-disponibles", response_model=list[SolicitudResponse])
def listar_solicitudes_disponibles(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).listar_solicitudes_disponibles()
