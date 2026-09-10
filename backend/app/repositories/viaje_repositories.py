from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.conductor_models import Conductor
from app.models.cooperativa_models import Cooperativa
from app.models.entrega_models import Entrega
from app.models.historial_asignacion_models import HistorialAsignacion
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo
from app.models.viaje_models import Viaje


class ViajeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_entregas_for_update(self, ids: list[UUID]):
        return self.db.query(Entrega).filter(Entrega.id_entrega.in_(ids)).order_by(Entrega.id_entrega).with_for_update().all()

    def get_vehiculo(self, vehiculo_id: int, for_update=False):
        query = self.db.query(Vehiculo).filter(Vehiculo.id_vehiculo == vehiculo_id)
        return query.with_for_update().first() if for_update else query.first()

    def get_conductor(self, conductor_id: int):
        return self.db.query(Conductor).filter(Conductor.id_conductor == conductor_id).first()

    def get_cooperativa(self, cooperativa_id: int):
        return self.db.query(Cooperativa).filter(Cooperativa.id_cooperativa == cooperativa_id).first()

    def get_orden_siguiente(self, vehiculo_id: int):
        maximo = self.db.query(func.coalesce(func.max(Viaje.orden_cola), 0)).filter(Viaje.vehiculo_id == vehiculo_id).scalar()
        return int(maximo) + 1

    def tiene_viajes_pendientes(self, vehiculo_id: int):
        return self.db.query(Viaje).filter(Viaje.vehiculo_id == vehiculo_id, Viaje.estado_viaje.in_(["asignado", "en_cola", "en_camino"])).first() is not None

    def get_viaje_for_update(self, viaje_id: UUID):
        return self.db.query(Viaje).filter(Viaje.id_viaje == viaje_id).with_for_update().first()

    def get_viajes_conductor(self, conductor_id: int, estados: list[str]):
        return self.db.query(Viaje).filter(Viaje.conductor_id == conductor_id, Viaje.estado_viaje.in_(estados)).order_by(Viaje.orden_cola).all()

    def get_cargas_viaje(self, viaje_id: UUID):
        return self.db.query(Entrega, Usuario).join(Usuario, Entrega.caficultor_id == Usuario.id_usuario).filter(Entrega.viaje_id == viaje_id).order_by(Entrega.orden_recoleccion).all()

    def viaje_activo_vehiculo_o_conductor(self, vehiculo_id: int, conductor_id: int):
        return self.db.query(Viaje).filter(Viaje.estado_viaje == "en_camino", or_(Viaje.vehiculo_id == vehiculo_id, Viaje.conductor_id == conductor_id)).first()

    def siguiente_en_cola(self, vehiculo_id: int):
        return self.db.query(Viaje).filter(Viaje.vehiculo_id == vehiculo_id, Viaje.estado_viaje == "en_cola").order_by(Viaje.orden_cola).with_for_update().first()

    def agregar_historial(self, entrega, viaje, coordinador_id):
        self.db.add(HistorialAsignacion(
            entrega_id=entrega.id_entrega, carga_id=entrega.solicitud.carga_id,
            vehiculo_id=viaje.vehiculo_id, conductor_id=viaje.conductor_id,
            coordinador_id=coordinador_id, fecha_hora_asignacion=viaje.creado_en,
            viaje_id=viaje.id_viaje,
        ))
