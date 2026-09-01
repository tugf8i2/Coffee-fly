from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.solicitud_schemas import (
    SolicitudCreate,
    SolicitudUpdate,
    SolicitudResponse,
    SincronizarSolicitudRequest,
    SincronizarSolicitudResponse,
)

from app.services.solicitud_services import (
    SolicitudService
)
from app.services.entrega_services import EntregaService
from app.core.auth import require_roles
from app.models.usuario_models import Usuario


router = APIRouter(
    prefix="/solicitudes",
    tags=["Solicitudes"]
)


@router.get(
    "/",
    response_model=list[SolicitudResponse]
)
def listar_solicitudes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):

    service = SolicitudService(db)

    return service.obtener_solicitudes(
        skip,
        limit
    )


@router.get("/mis-solicitudes")
def consultar_dashboard_caficultor(
    db: Session = Depends(get_db),
    caficultor: Usuario = Depends(require_roles("caficultor")),
):
    return SolicitudService(db).obtener_dashboard_caficultor(caficultor.id_usuario)


@router.get("/mi-seguimiento")
def consultar_seguimiento_caficultor(
    db: Session = Depends(get_db),
    caficultor: Usuario = Depends(require_roles("caficultor")),
):
    return EntregaService(db).obtener_mi_seguimiento(caficultor.id_usuario, caficultor)


@router.post("/sincronizar", response_model=SincronizarSolicitudResponse)
def sincronizar_solicitud_offline(
    datos: SincronizarSolicitudRequest,
    db: Session = Depends(get_db),
    caficultor: Usuario = Depends(require_roles("caficultor")),
):
    return SolicitudService(db).sincronizar_solicitud(datos, caficultor.id_usuario)


@router.get(
    "/{id_solicitud}",
    response_model=SolicitudResponse
)
def obtener_solicitud(
    id_solicitud: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = SolicitudService(db)

    return service.obtener_solicitud(
        id_solicitud, usuario
    )


@router.post(
    "/",
    response_model=SolicitudResponse
)
def crear_solicitud(
    solicitud: SolicitudCreate,
    db: Session = Depends(get_db)
    , caficultor: Usuario = Depends(require_roles("caficultor")),
):

    service = SolicitudService(db)

    solicitud = solicitud.model_copy(update={
        "caficultor_id": caficultor.id_usuario,
        "estado_solicitud": "pendiente",
    })

    return service.crear_solicitud(solicitud, caficultor.id_usuario)


@router.put(
    "/{id_solicitud}",
    response_model=SolicitudResponse
)
def actualizar_solicitud(
    id_solicitud: UUID,
    solicitud: SolicitudUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = SolicitudService(db)

    return service.actualizar_solicitud(
        id_solicitud,
        solicitud, usuario
    )


@router.delete(
    "/{id_solicitud}"
)
def eliminar_solicitud(
    id_solicitud: UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("coordinador", "caficultor")),
):

    service = SolicitudService(db)

    return service.eliminar_solicitud(
        id_solicitud, usuario
    )
