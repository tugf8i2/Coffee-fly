from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.vehiculo_schemas import (
    VehiculoCreate,
    VehiculoUpdate,
    VehiculoResponse,
    ConfiguracionVehicularResponse,
    ConfiguracionVehicularUpdate,
)

from app.services.vehiculo_services import (
    VehiculoService
)
from app.core.auth import require_registrador, require_roles
from app.models.conductor_models import Conductor
from app.models.rol_models import Rol
from app.models.usuario_models import Usuario
from app.services.compatibilidad_transporte import evaluar_conductor


router = APIRouter(
    prefix="/vehiculos",
    tags=["Vehiculos"]
)


@router.get("/catalogo", response_model=list[ConfiguracionVehicularResponse])
def catalogo_vehicular(db: Session = Depends(get_db), _usuario: Usuario = Depends(require_roles("registrador", "coordinador"))):
    return VehiculoService(db).catalogo()


@router.put("/catalogo/{codigo}", response_model=ConfiguracionVehicularResponse)
def actualizar_catalogo(codigo: str, datos: ConfiguracionVehicularUpdate,
                       db: Session = Depends(get_db), registrador: Usuario = Depends(require_registrador)):
    return VehiculoService(db).actualizar_catalogo(codigo, datos, registrador.id_usuario)


@router.get("/compatibilidad")
def compatibilidad_vehiculos(peso_kg: float = Query(gt=0), cooperativa_id: int | None = None,
                            db: Session = Depends(get_db), _coordinador: Usuario = Depends(require_roles("coordinador"))):
    return VehiculoService(db).compatibilidad(peso_kg, cooperativa_id)


@router.get("/{id_vehiculo}/conductores-compatibles")
def compatibilidad_conductores(id_vehiculo: int, cooperativa_id: int | None = None,
                              db: Session = Depends(get_db), _coordinador: Usuario = Depends(require_roles("coordinador"))):
    vehiculo = VehiculoService(db).obtener_vehiculo(id_vehiculo)
    return [dict(id_conductor=conductor.id_conductor,
                 nombre_conductor=f"{conductor.usuarios.nombre_usuario} {conductor.usuarios.apellido}".strip(),
                 licencia=conductor.licencia,
                 fecha_vencimiento_licencia=conductor.fecha_vencimiento_licencia,
                 tiene_foto_licencia=bool(conductor.foto_licencia),
                 **evaluar_conductor(db, conductor, vehiculo, cooperativa_id))
            for conductor in db.query(Conductor).order_by(Conductor.id_conductor).all()]


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
    registrador: Usuario = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.crear_vehiculo(vehiculo, registrador.id_usuario)


@router.put(
    "/{id_vehiculo}",
    response_model=VehiculoResponse
)
def actualizar_vehiculo(
    id_vehiculo: int,
    vehiculo: VehiculoUpdate,
    db: Session = Depends(get_db),
    registrador: Usuario = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.actualizar_vehiculo(
        id_vehiculo,
        vehiculo,
        registrador.id_usuario,
    )


@router.delete(
    "/{id_vehiculo}"
)
def eliminar_vehiculo(
    id_vehiculo: int,
    db: Session = Depends(get_db),
    registrador: Usuario = Depends(require_registrador),
):

    service = VehiculoService(db)

    return service.eliminar_vehiculo(
        id_vehiculo,
        registrador.id_usuario,
    )
