from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.core.realtime import tracking_connections
from app.models.usuario_models import Usuario
from app.schemas.entrega_schemas import ActualizarEstadoEntregaRequest, AsignarVehiculoRequest, ConductorDisponibleResponse, EntregaAsignadaResponse, EntregaCreate, EntregaHistorialPagina, EntregaPendienteAsignacionResponse, EntregaResponse, EventoConductorResponse, HistorialAsignacionResponse, HistorialEstadoEntregaLoteResponse, HistorialEstadoEntregaResponse, NotificacionEventoResponse, RegistrarUbicacionRequest, RegistrarUbicacionResponse, ReportarEventoConductorRequest, SeguimientoEntregaResponse, SincronizarUbicacionesRequest, SincronizarUbicacionesResponse, SolicitudActivaEntregaResponse, VehiculoDisponibleResponse
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


@router.get("/historial", response_model=EntregaHistorialPagina)
def consultar_historial_entregas(
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    caficultor_id: int | None = None,
    estado: Literal["pendiente", "en camino", "entregado", "cancelado"] | None = None,
    vehiculo_id: int | None = None,
    pagina: int = 1,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):
    if pagina < 1:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="La página debe iniciar en 1")
    return EntregaService(db).obtener_historial(usuario, fecha_desde, fecha_hasta, caficultor_id, estado, vehiculo_id, pagina)


@router.get("/mis-asignadas", response_model=list[EntregaAsignadaResponse])
def listar_mis_entregas_asignadas(
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        return []
    return EntregaService(db).obtener_entregas_asignadas(conductor.conductor.id_conductor)


@router.get("/mi-seguimiento", response_model=SeguimientoEntregaResponse)
def consultar_mi_seguimiento(
    db: Session = Depends(get_db),
    caficultor: Usuario = Depends(require_roles("caficultor")),
):
    return EntregaService(db).obtener_mi_seguimiento(caficultor.id_usuario, caficultor)


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


@router.get("/historial-estados/lote", response_model=list[HistorialEstadoEntregaLoteResponse])
def obtener_historial_estados_lote(
    entrega_id: list[UUID] = Query(min_length=1, max_length=100),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "conductor")),
):
    es_conductor = bool(usuario.rol and usuario.rol.descripcion_rol.lower() == "conductor")
    return EntregaService(db).obtener_historial_estados_lote(entrega_id, usuario, es_conductor)


@router.get("/eventos/notificaciones", response_model=list[NotificacionEventoResponse])
def listar_notificaciones_eventos(
    entrega_id: UUID | None = None,
    estado: Literal["pendiente", "en camino", "entregado", "cancelado"] | None = None,
    tipo_evento: Literal["inicio del viaje", "retraso", "llegada", "inconveniente", "entrega realizada", "daño vehicular", "parada baño", "imprevisto nuevo"] | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):
    return EntregaService(db).obtener_notificaciones_eventos(usuario, entrega_id, estado, tipo_evento)


@router.delete("/eventos/{evento_id}")
def eliminar_notificacion_evento(
    evento_id: UUID,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return EntregaService(db).eliminar_evento(evento_id)


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
        entrega_id, cambio.estado_entrega, conductor.id_usuario, conductor.conductor.id_conductor, cambio.modificado_en
    )


@router.post("/{entrega_id}/ubicacion", response_model=RegistrarUbicacionResponse)
def registrar_ubicacion_entrega(
    entrega_id: UUID,
    punto: RegistrarUbicacionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="El usuario no tiene un perfil de conductor")
    resultado = EntregaService(db).registrar_ubicacion(
        entrega_id, punto, conductor.conductor.id_conductor
    )
    if resultado["estado"] == "guardado":
        background_tasks.add_task(tracking_connections.broadcast, entrega_id, {
            "tipo": "ubicacion",
            "entrega_id": entrega_id,
            "punto": {
                "client_point_id": punto.client_point_id,
                "latitud": punto.latitud,
                "longitud": punto.longitud,
                "precision_m": punto.precision_m,
                "velocidad_m_s": punto.velocidad_m_s,
                "rumbo_grados": punto.rumbo_grados,
                "registrada_en": resultado["registrada_en"],
            },
            "distancia_recorrida_m": resultado["distancia_recorrida_m"],
        })
    return resultado


@router.post("/{entrega_id}/ubicaciones/sincronizar", response_model=SincronizarUbicacionesResponse)
def sincronizar_ubicaciones_entrega(
    entrega_id: UUID,
    lote: SincronizarUbicacionesRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="El usuario no tiene un perfil de conductor")
    resultado = EntregaService(db).sincronizar_ubicaciones(
        entrega_id, lote, conductor.conductor.id_conductor
    )
    nuevos = {
        str(item["client_point_id"]): item
        for item in resultado["resultados"] if item["estado"] == "guardado"
    }
    puntos = [{
        "client_point_id": punto.client_point_id,
        "latitud": punto.latitud,
        "longitud": punto.longitud,
        "precision_m": punto.precision_m,
        "velocidad_m_s": punto.velocidad_m_s,
        "rumbo_grados": punto.rumbo_grados,
        "registrada_en": nuevos[str(punto.client_point_id)]["registrada_en"],
    } for punto in lote.puntos if str(punto.client_point_id) in nuevos]
    if puntos:
        puntos.sort(key=lambda item: item["registrada_en"])
        background_tasks.add_task(tracking_connections.broadcast, entrega_id, {
            "tipo": "ubicaciones",
            "entrega_id": entrega_id,
            "puntos": puntos,
            "distancia_recorrida_m": resultado["distancia_recorrida_m"],
        })
    return resultado


@router.get("/{entrega_id}/seguimiento", response_model=SeguimientoEntregaResponse)
def consultar_seguimiento_entrega(
    entrega_id: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "conductor", "caficultor")),
):
    return EntregaService(db).obtener_seguimiento(entrega_id, usuario)


@router.get("/{entrega_id}/historial-estados", response_model=list[HistorialEstadoEntregaResponse])
def obtener_historial_estados(
    entrega_id: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "conductor")),
):
    es_conductor = bool(usuario.rol and usuario.rol.descripcion_rol.lower() == "conductor")
    return EntregaService(db).obtener_historial_estados(entrega_id, usuario, es_conductor)


@router.get("/{entrega_id}/eventos-conductor", response_model=list[EventoConductorResponse])
def listar_eventos_conductor(
    entrega_id: UUID,
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="El usuario no tiene un perfil de conductor")
    return EntregaService(db).obtener_eventos_conductor(entrega_id, conductor.conductor.id_conductor)


@router.post("/{entrega_id}/eventos-conductor", response_model=EventoConductorResponse, status_code=201)
def reportar_evento_conductor(
    entrega_id: UUID,
    reporte: ReportarEventoConductorRequest,
    db: Session = Depends(get_db),
    conductor: Usuario = Depends(require_roles("conductor")),
):
    if conductor.conductor is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="El usuario no tiene un perfil de conductor")
    return EntregaService(db).reportar_evento_conductor(
        entrega_id,
        reporte.tipo_evento,
        reporte.detalle,
        conductor.id_usuario,
        conductor.conductor.id_conductor,
    )
