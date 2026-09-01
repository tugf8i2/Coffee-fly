from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.vehiculo_schemas import (
    VehiculoCreate,
    VehiculoUpdate,
    VehiculoResponse
)

from app.services.vehiculo_services import (
    VehiculoService
)
from app.core.auth import require_registrador, require_roles
from app.models.conductor_models import Conductor
from app.models.rol_models import Rol
from app.models.usuario_models import Usuario


router = APIRouter(
    prefix="/vehiculos",
    tags=["Vehiculos"]
)


@router.get("/conductores-disponibles")
def listar_conductores_para_vehiculo(
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):
    return [
        {"id_conductor": conductor.id_conductor, "nombre": f"{usuario.nombre_usuario} {usuario.apellido}".strip(), "licencia": conductor.licencia}
        for conductor, usuario in db.query(Conductor, Usuario).join(Usuario, Conductor.usuario_id == Usuario.id_usuario).join(
            Rol, Usuario.rol_id == Rol.id_rol
        ).filter(Rol.descripcion_rol.ilike("conductor")).order_by(Usuario.nombre_usuario).all()
    ]


@router.get("/estado", response_model=list[VehiculoResponse])
def consultar_panel_estado_vehiculos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _usuario: Usuario = Depends(require_roles("registrador", "coordinador")),
):
    """Panel de solo lectura: el coordinador puede identificar todos los
    vehículos y el registrador conserva las operaciones de administración."""
    return VehiculoService(db).obtener_vehiculos(skip, limit)


@router.get(
    "/",
    response_model=list[VehiculoResponse]
)
def listar_vehiculos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.obtener_vehiculos(
        skip,
        limit
    )


@router.get(
    "/{id_vehiculo}",
    response_model=VehiculoResponse
)
def obtener_vehiculo(
    id_vehiculo: int,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.obtener_vehiculo(
        id_vehiculo
    )


@router.post(
    "/",
    response_model=VehiculoResponse
)
def crear_vehiculo(
    vehiculo: VehiculoCreate,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.crear_vehiculo(
        vehiculo
    )


@router.put(
    "/{id_vehiculo}",
    response_model=VehiculoResponse
)
def actualizar_vehiculo(
    id_vehiculo: int,
    vehiculo: VehiculoUpdate,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.actualizar_vehiculo(
        id_vehiculo,
        vehiculo
    )


@router.delete(
    "/{id_vehiculo}"
)
def eliminar_vehiculo(
    id_vehiculo: int,
    db: Session = Depends(get_db),
    _registrador = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.eliminar_vehiculo(
        id_vehiculo
    )
