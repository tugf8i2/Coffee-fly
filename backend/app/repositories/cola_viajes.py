from sqlalchemy import func

from app.models.viaje_models import Viaje


ESTADOS_COLA = ("asignado", "en_cola", "en_camino")


def siguiente_orden_cola(db, vehiculo_id: int) -> int:
    maximo = db.query(func.coalesce(func.max(Viaje.orden_cola), 0)).filter(
        Viaje.vehiculo_id == vehiculo_id,
        Viaje.estado_viaje.in_(ESTADOS_COLA),
    ).scalar()
    return int(maximo) + 1


def renumerar_cola_vehiculo(db, vehiculo_id: int) -> list[Viaje]:
    viajes = db.query(Viaje).filter(
        Viaje.vehiculo_id == vehiculo_id,
        Viaje.estado_viaje.in_(ESTADOS_COLA),
    ).order_by(Viaje.orden_cola, Viaje.creado_en, Viaje.id_viaje).with_for_update().all()
    if not viajes:
        return []

    # Libera primero los números actuales para no chocar con el índice único parcial.
    temporal = max(viaje.orden_cola for viaje in viajes) + len(viajes) + 1
    for desplazamiento, viaje in enumerate(viajes):
        viaje.orden_cola = temporal + desplazamiento
    db.flush()

    hay_viaje_activo = any(viaje.estado_viaje == "en_camino" for viaje in viajes)
    for turno, viaje in enumerate(viajes, 1):
        viaje.orden_cola = turno
        if viaje.estado_viaje != "en_camino":
            viaje.estado_viaje = "en_cola" if hay_viaje_activo or turno > 1 else "asignado"
    return viajes
