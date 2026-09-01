from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.carga_models import Carga
from app.models.entrega_models import Entrega
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/")
def obtener_dashboard(usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    inicio = datetime.combine(datetime.now().date(), time.min)
    fin = inicio + timedelta(days=1)
    role = usuario.rol.descripcion_rol.lower() if usuario.rol else ""
    if role == "caficultor":
        activas = db.query(func.count(Solicitud.id_solicitud)).filter(
            Solicitud.caficultor_id == usuario.id_usuario, Solicitud.estado_solicitud.in_(["pendiente", "en camino"])
        ).scalar() or 0
        entregadas = db.query(func.count(Entrega.id_entrega)).filter(
            Entrega.caficultor_id == usuario.id_usuario, Entrega.estado_entrega == "entregado"
        ).scalar() or 0
        return {"rol": role, "actualizado_en": datetime.now(), "metricas": {"solicitudes_activas": activas, "entregas_realizadas": entregadas}}
    if role == "conductor":
        conductor_id = usuario.conductor.id_conductor if usuario.conductor else -1
        asignadas = db.query(func.count(Entrega.id_entrega)).join(Solicitud, Entrega.solicitud_id == Solicitud.id_solicitud).join(
            Carga, Solicitud.carga_id == Carga.id_carga).join(Vehiculo, Carga.vehiculo_id == Vehiculo.id_vehiculo).filter(
            Vehiculo.conductor_id == conductor_id, Entrega.estado_entrega.in_(["pendiente", "en camino"])
        ).scalar() or 0
        return {"rol": role, "actualizado_en": datetime.now(), "metricas": {"entregas_asignadas": asignadas}}
    entregas_hoy = db.query(func.count(Entrega.id_entrega)).filter(Entrega.fecha_hora_entrega >= inicio, Entrega.fecha_hora_entrega < fin).scalar() or 0
    kg_hoy = db.query(func.coalesce(func.sum(Entrega.cantidad_kg), 0)).filter(
        Entrega.fecha_hora_entrega >= inicio, Entrega.fecha_hora_entrega < fin, Entrega.estado_entrega != "cancelado"
    ).scalar() or 0
    vehiculos_activos = db.query(func.count(Vehiculo.id_vehiculo)).filter(Vehiculo.estado_vehiculo == "en camino").scalar() or 0
    return {"rol": role, "actualizado_en": datetime.now(), "metricas": {"entregas_hoy": entregas_hoy, "vehiculos_activos": vehiculos_activos, "kilogramos_recolectados": float(kg_hoy)}}
