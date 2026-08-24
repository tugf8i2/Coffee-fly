from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.models.usuario_models import Usuario
from app.schemas.entrega_schemas import ActualizarEstadoEntregaRequest, AsignarVehiculoRequest, ConductorDisponibleResponse, EntregaAsignadaResponse, EntregaCreate, EntregaPendienteAsignacionResponse, EntregaResponse, HistorialAsignacionResponse, HistorialEstadoEntregaResponse, SolicitudActivaEntregaResponse, VehiculoDisponibleResponse
from app.services.entrega_services import EntregaService


router = APIRouter(prefix="/entregas", tags=["Entregas"])


@router.get("/", response_model=list[EntregaResponse])
def listar_entregas(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).obtener_entregas(skip, limit)


@router.get("/mis-asignadas", response_model=list[EntregaAsignadaResponse])
def listar_mis_entregas_asignadas(
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        return []
    return EntregaService(db).obtener_entregas_asignadas(conductor.conductor.id_conductor)


@router.get("/solicitudes-activas", response_model=list[SolicitudActivaEntregaResponse])
def listar_solicitudes_activas(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).obtener_solicitudes_activas()


@router.post("/", response_model=EntregaResponse, status_code=201)
def crear_entrega(
    entrega: EntregaCreate,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).crear_entrega(entrega)


@router.get("/pendientes-asignacion", response_model=list[EntregaPendienteAsignacionResponse])
def listar_pendientes_asignacion(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).obtener_pendientes_asignacion()


@router.get("/vehiculos-disponibles", response_model=list[VehiculoDisponibleResponse])
def listar_vehiculos_disponibles(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).obtener_vehiculos_disponibles()


@router.get("/conductores-disponibles", response_model=list[ConductorDisponibleResponse])
def listar_conductores_disponibles(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).obtener_conductores_disponibles()


@router.get("/historial-asignaciones", response_model=list[HistorialAsignacionResponse])
def listar_historial_asignaciones(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).obtener_historial_asignaciones()


@router.post("/{entrega_id}/asignar-vehiculo", response_model=EntregaResponse)
def asignar_vehiculo(
    entrega_id: str,
    asignacion: AsignarVehiculoRequest,
    db: Session = Depends(get_db),
    coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).asignar_vehiculo(
        UUID(entrega_id), asignacion.vehiculo_id, asignacion.conductor_id, coordinador.id_usuario
    )


@router.patch("/{entrega_id}/estado", response_model=EntregaResponse)
def actualizar_estado_entrega(
    entrega_id: UUID,
    cambio: ActualizarEstadoEntregaRequest,
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="El usuario no tiene un perfil de conductor")
    return EntregaService(db).actualizar_estado(
        entrega_id, cambio.estado_entrega, conductor.id_usuario, conductor.conductor.id_conductor
    )


@router.get("/{entrega_id}/historial-estados", response_model=list[HistorialEstadoEntregaResponse])
def obtener_historial_estados(
    entrega_id: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "conductor")),
):
    es_conductor = bool(usuario.rol and usuario.rol.descripcion_rol.lower() == "conductor")
    return EntregaService(db).obtener_historial_estados(entrega_id, usuario, es_conductor)
