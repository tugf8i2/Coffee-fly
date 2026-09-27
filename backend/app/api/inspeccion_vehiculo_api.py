from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.core.time import utc_now_naive
from app.models.inspeccion_vehiculo_models import InspeccionVehiculo
from app.models.usuario_models import Usuario
from app.models.viaje_models import Viaje
from app.schemas.inspeccion_vehiculo_schemas import (
    InspeccionVehiculoCreate,
    InspeccionVehiculoResponse,
)


router = APIRouter(prefix="/inspecciones-vehiculo", tags=["Inspecciones de vehículo"])


def _conductor_id(usuario: Usuario) -> int:
    if usuario.conductor is None:
        raise HTTPException(status_code=403, detail="El usuario no tiene perfil de conductor")
    return usuario.conductor.id_conductor


@router.post("/", response_model=InspeccionVehiculoResponse, status_code=status.HTTP_201_CREATED)
def registrar_inspeccion(
    datos: InspeccionVehiculoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("conductor")),
):
    conductor_id = _conductor_id(usuario)
    existente = db.query(InspeccionVehiculo).filter(
        InspeccionVehiculo.client_inspection_id == datos.client_inspection_id
    ).first()
    if existente:
        if existente.conductor_id != conductor_id:
            raise HTTPException(status_code=409, detail="El identificador de inspección ya pertenece a otro conductor")
        return existente
    viaje = db.get(Viaje, datos.viaje_id)
    if not viaje or viaje.conductor_id != conductor_id or viaje.vehiculo_id != datos.vehiculo_id:
        raise HTTPException(status_code=403, detail="La inspección no corresponde a un viaje y vehículo asignados al conductor")
    if viaje.estado_viaje not in {"asignado", "en_cola", "en_camino"}:
        raise HTTPException(status_code=409, detail="El viaje ya no admite una inspección preoperacional")
    items = [item.model_dump() for item in datos.items]
    record = InspeccionVehiculo(
        client_inspection_id=datos.client_inspection_id,
        vehiculo_id=datos.vehiculo_id,
        conductor_id=conductor_id,
        viaje_id=datos.viaje_id,
        estado_general="con_novedades" if any(item["estado"] == "novedad" for item in items) else "aprobada",
        items=items,
        capturada_en=datos.capturada_en.replace(tzinfo=None),
        sincronizada_en=utc_now_naive(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/mias", response_model=list[InspeccionVehiculoResponse])
def mis_inspecciones(
    viaje_id: UUID | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("conductor")),
):
    query = db.query(InspeccionVehiculo).filter(InspeccionVehiculo.conductor_id == _conductor_id(usuario))
    if viaje_id:
        query = query.filter(InspeccionVehiculo.viaje_id == viaje_id)
    return query.order_by(InspeccionVehiculo.capturada_en.desc()).limit(limit).all()


@router.get("/vehiculo/{vehiculo_id}", response_model=list[InspeccionVehiculoResponse])
def inspecciones_vehiculo(
    vehiculo_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _usuario: Usuario = Depends(require_roles("registrador", "coordinador")),
):
    return db.query(InspeccionVehiculo).filter(
        InspeccionVehiculo.vehiculo_id == vehiculo_id
    ).order_by(InspeccionVehiculo.capturada_en.desc()).limit(limit).all()
