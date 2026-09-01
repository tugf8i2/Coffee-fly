from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.database import get_db
from app.core.observability import process_metrics
from app.models.carga_models import Carga
from app.models.entrega_models import Entrega
from app.models.seguimiento_ubicacion_models import SeguimientoUbicacion
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo

router = APIRouter(prefix="/monitoreo", tags=["Monitoreo"])
GPS_STALE_AFTER_SECONDS = 120


def classify_gps_state(last_location: datetime | None, now: datetime) -> tuple[str, int | None]:
    if last_location is None:
        return "sin_ubicacion", None
    comparable = last_location
    if comparable.tzinfo is None:
        comparable = comparable.replace(tzinfo=timezone.utc)
    age_seconds = max(0, int((now - comparable).total_seconds()))
    state = "desactualizado" if age_seconds > GPS_STALE_AFTER_SECONDS else "actualizado"
    return state, age_seconds


@router.get("/resumen")
def resumen_operacional(
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    latest = db.query(
        SeguimientoUbicacion.entrega_id.label("entrega_id"),
        SeguimientoUbicacion.latitud.label("latitud"),
        SeguimientoUbicacion.longitud.label("longitud"),
        SeguimientoUbicacion.precision_m.label("precision_m"),
        SeguimientoUbicacion.velocidad_m_s.label("velocidad_m_s"),
        SeguimientoUbicacion.rumbo_grados.label("rumbo_grados"),
        SeguimientoUbicacion.registrada_en.label("ultima_ubicacion"),
        func.row_number().over(
            partition_by=SeguimientoUbicacion.entrega_id,
            order_by=(
                SeguimientoUbicacion.registrada_en.desc(),
                SeguimientoUbicacion.id_ubicacion.desc(),
            ),
        ).label("orden"),
    ).subquery()
    rows = db.query(
        Entrega,
        Vehiculo,
        latest.c.ultima_ubicacion,
        latest.c.latitud,
        latest.c.longitud,
        latest.c.precision_m,
        latest.c.velocidad_m_s,
        latest.c.rumbo_grados,
    ).join(
        Solicitud, Entrega.solicitud_id == Solicitud.id_solicitud
    ).join(Carga, Solicitud.carga_id == Carga.id_carga).join(
        Vehiculo, Carga.vehiculo_id == Vehiculo.id_vehiculo
    ).outerjoin(
        latest,
        and_(latest.c.entrega_id == Entrega.id_entrega, latest.c.orden == 1),
    ).filter(
        Entrega.estado_entrega == "en camino"
    ).order_by(Entrega.fecha_hora_entrega.asc()).all()

    now = datetime.now(timezone.utc)
    vehicles = []
    for (
        delivery,
        vehicle,
        last_location,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
    ) in rows:
        state, age_seconds = classify_gps_state(last_location, now)
        vehicles.append({
            "entrega_id": delivery.id_entrega,
            "vehiculo_id": vehicle.id_vehiculo,
            "placa": vehicle.placa,
            "estado_gps": state,
            "ultima_ubicacion": last_location,
            "segundos_sin_actualizar": age_seconds,
            "latitud": float(latitude) if latitude is not None else None,
            "longitud": float(longitude) if longitude is not None else None,
            "precision_m": float(accuracy) if accuracy is not None else None,
            "velocidad_m_s": float(speed) if speed is not None else None,
            "rumbo_grados": float(heading) if heading is not None else None,
        })
    return {
        "generado_en": now,
        "vehiculos_en_camino": len(vehicles),
        "vehiculos_actualizados": sum(item["estado_gps"] == "actualizado" for item in vehicles),
        "vehiculos_desactualizados": sum(item["estado_gps"] == "desactualizado" for item in vehicles),
        "vehiculos_sin_ubicacion": sum(item["estado_gps"] == "sin_ubicacion" for item in vehicles),
        "metricas_proceso": process_metrics.snapshot(),
        "vehiculos": vehicles,
    }
