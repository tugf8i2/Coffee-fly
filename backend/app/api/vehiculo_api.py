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


router = APIRouter(
    prefix="/vehiculos",
    tags=["Vehiculos"]
)


@router.get(
    "/",
    response_model=list[VehiculoResponse]
)
def listar_vehiculos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
):

    service = VehiculoService(db)

    return service.eliminar_vehiculo(
        id_vehiculo
    )