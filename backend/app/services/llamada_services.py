from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.conductor_models import Conductor
from app.models.usuario_models import Usuario
from app.models.viaje_models import Viaje


CALLABLE_STATES = ("asignado", "en_cola", "en_camino")


def call_role(user: Usuario) -> str:
    return user.rol.descripcion_rol.lower() if user.rol else ""


def call_contacts(db: Session, user: Usuario) -> list[dict]:
    role = call_role(user)
    if role not in {"coordinador", "conductor"}:
        raise HTTPException(status_code=403, detail="No tienes acceso a llamadas de ruta")
    query = db.query(Viaje).filter(Viaje.estado_viaje.in_(CALLABLE_STATES))
    if role == "coordinador":
        query = query.filter(Viaje.coordinador_id == user.id_usuario)
    else:
        if user.conductor is None:
            raise HTTPException(status_code=403, detail="No tienes perfil de conductor")
        query = query.filter(Viaje.conductor_id == user.conductor.id_conductor)
    contacts = []
    for trip in query.order_by(Viaje.creado_en.desc()).all():
        other = call_peer(db, trip, role)
        expected_role = "coordinador" if role == "conductor" else "conductor"
        if other is None or call_role(other) != expected_role or not other.habilitado or other.eliminado_en is not None:
            continue
        contacts.append({
            "viaje_id": str(trip.id_viaje),
            "estado_viaje": trip.estado_viaje,
            "usuario_id": other.id_usuario,
            "nombre": f"{other.nombre_usuario} {other.apellido}".strip(),
            "rol": call_role(other),
        })
    return contacts


def call_peer(db: Session, trip: Viaje, role: str) -> Usuario | None:
    if role == "conductor":
        return db.query(Usuario).filter(Usuario.id_usuario == trip.coordinador_id).first()
    return (
        db.query(Usuario)
        .join(Conductor, Conductor.usuario_id == Usuario.id_usuario)
        .filter(Conductor.id_conductor == trip.conductor_id)
        .first()
    )


def authorized_call_peer(db: Session, user: Usuario, trip_id: UUID) -> int:
    role = call_role(user)
    trip = db.query(Viaje).filter(Viaje.id_viaje == trip_id).first()
    if trip is None or trip.estado_viaje not in CALLABLE_STATES:
        raise HTTPException(status_code=404, detail="Viaje no disponible para llamada")
    if role == "coordinador" and trip.coordinador_id != user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes acceso a este viaje")
    if role == "conductor" and (user.conductor is None or trip.conductor_id != user.conductor.id_conductor):
        raise HTTPException(status_code=403, detail="No tienes acceso a este viaje")
    if role not in {"coordinador", "conductor"}:
        raise HTTPException(status_code=403, detail="No tienes acceso a llamadas de ruta")
    other = call_peer(db, trip, role)
    expected_role = "coordinador" if role == "conductor" else "conductor"
    if other is None or call_role(other) != expected_role or not other.habilitado or other.eliminado_en is not None:
        raise HTTPException(status_code=404, detail="Participante no disponible")
    return other.id_usuario
