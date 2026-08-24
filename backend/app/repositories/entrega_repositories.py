from datetime import datetime, time, timedelta
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased

from app.models.carga_models import Carga
from app.models.conductor_models import Conductor
from app.models.entrega_models import Entrega
from app.models.historial_estado_entrega_models import HistorialEstadoEntrega
from app.models.historial_asignacion_models import HistorialAsignacion
from app.models.solicitud_models import Solicitud
from app.models.rol_models import Rol
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo


class EntregaRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_entregas(self, skip: int = 0, limit: int = 100) -> list[Entrega]:
        inicio_dia = datetime.combine(datetime.now().date(), time.min)
        fin_dia = inicio_dia + timedelta(days=1)
        return self.db.query(Entrega).filter(
            Entrega.fecha_hora_entrega >= inicio_dia,
            Entrega.fecha_hora_entrega < fin_dia,
        ).order_by(Entrega.fecha_hora_entrega.desc()).offset(skip).limit(limit).all()

    def get_solicitud_activa(self, solicitud_id: UUID) -> Solicitud | None:
        return self.db.query(Solicitud).filter(
            Solicitud.id_solicitud == solicitud_id,
            Solicitud.estado_solicitud.in_(["pendiente", "en camino"]),
        ).first()

    def get_solicitud(self, solicitud_id: UUID) -> Solicitud | None:
        return self.db.query(Solicitud).filter(Solicitud.id_solicitud == solicitud_id).first()

    def get_solicitudes_activas(self):
        return self.db.query(Solicitud, Usuario, Carga).join(
            Usuario, Solicitud.caficultor_id == Usuario.id_usuario
        ).outerjoin(
            Carga, Solicitud.carga_id == Carga.id_carga
        ).filter(
            Solicitud.estado_solicitud.in_(["pendiente", "en camino"])
        ).order_by(Solicitud.fecha_hora_solicitud.asc()).all()

    def create_entrega(self, entrega: Entrega) -> Entrega:
        self.db.add(entrega)
        self.db.commit()
        self.db.refresh(entrega)
        return entrega

    def get_entrega(self, entrega_id: UUID) -> Entrega | None:
        return self.db.query(Entrega).filter(Entrega.id_entrega == entrega_id).first()

    def get_entrega_asignada_a_conductor(self, entrega_id: UUID, conductor_id: int) -> Entrega | None:
        return self.db.query(Entrega).join(
            Solicitud, Entrega.solicitud_id == Solicitud.id_solicitud
        ).join(
            Carga, Solicitud.carga_id == Carga.id_carga
        ).join(
            Vehiculo, Carga.vehiculo_id == Vehiculo.id_vehiculo
        ).filter(
            Entrega.id_entrega == entrega_id,
            Vehiculo.conductor_id == conductor_id,
        ).first()

    def get_entregas_asignadas_a_conductor(self, conductor_id: int):
        return self.db.query(Entrega, Usuario, Vehiculo).join(
            Usuario, Entrega.caficultor_id == Usuario.id_usuario
        ).join(
            Solicitud, Entrega.solicitud_id == Solicitud.id_solicitud
        ).join(
            Carga, Solicitud.carga_id == Carga.id_carga
        ).join(
            Vehiculo, Carga.vehiculo_id == Vehiculo.id_vehiculo
        ).filter(
            Vehiculo.conductor_id == conductor_id
        ).order_by(Entrega.fecha_hora_entrega.desc()).all()

    def get_historial_estados(self, entrega_id: UUID):
        return self.db.query(HistorialEstadoEntrega, Usuario).join(
            Usuario, HistorialEstadoEntrega.usuario_id == Usuario.id_usuario
        ).filter(
            HistorialEstadoEntrega.entrega_id == entrega_id
        ).order_by(HistorialEstadoEntrega.fecha_hora_cambio.desc()).all()

    def actualizar_estado(self, entrega: Entrega, estado_nuevo: str, usuario_id: int):
        estado_anterior = entrega.estado_entrega
        entrega.estado_entrega = estado_nuevo
        self.db.add(HistorialEstadoEntrega(
            entrega_id=entrega.id_entrega,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            usuario_id=usuario_id,
            fecha_hora_cambio=datetime.now(),
        ))
        self.db.commit()
        self.db.refresh(entrega)
        return entrega

    def get_entregas_pendientes_asignacion(self):
        return self.db.query(Entrega, Usuario, Solicitud, Carga).join(
            Usuario, Entrega.caficultor_id == Usuario.id_usuario
        ).join(
            Solicitud, Entrega.solicitud_id == Solicitud.id_solicitud
        ).outerjoin(
            Carga, Solicitud.carga_id == Carga.id_carga
        ).outerjoin(
            Vehiculo, Carga.vehiculo_id == Vehiculo.id_vehiculo
        ).filter(
            Entrega.estado_entrega == "pendiente",
            # También se recuperan asignaciones antiguas que tenían vehículo
            # pero nunca recibieron conductor, para poder completarlas.
            or_(Carga.vehiculo_id.is_(None), Vehiculo.conductor_id.is_(None)),
        ).order_by(Entrega.fecha_hora_entrega.asc()).all()

    def get_vehiculos_disponibles(self):
        return self.db.query(Vehiculo).filter(Vehiculo.estado_vehiculo == "disponible").order_by(Vehiculo.placa).all()

    def get_peso_cargado_vehiculo(self, vehiculo_id: int) -> float:
        peso = self.db.query(func.coalesce(func.sum(Carga.peso_kg), 0)).filter(
            Carga.vehiculo_id == vehiculo_id
        ).scalar()
        return float(peso or 0)

    def get_conductores_disponibles(self):
        return self.db.query(Usuario, Conductor).join(
            Rol, Usuario.rol_id == Rol.id_rol
        ).outerjoin(
            Conductor, Conductor.usuario_id == Usuario.id_usuario
        ).filter(
            func.lower(Rol.descripcion_rol) == "conductor"
        ).order_by(Usuario.nombre_usuario, Usuario.apellido).all()

    def get_conductor(self, conductor_id: int) -> Conductor | None:
        return self.db.query(Conductor).filter(Conductor.id_conductor == conductor_id).first()

    def get_historial_asignaciones(self):
        conductor_usuario = aliased(Usuario)
        coordinador_usuario = aliased(Usuario)
        caficultor_usuario = aliased(Usuario)
        return self.db.query(
            HistorialAsignacion, Entrega, Vehiculo, conductor_usuario, coordinador_usuario, caficultor_usuario
        ).join(
            Entrega, HistorialAsignacion.entrega_id == Entrega.id_entrega
        ).join(
            Vehiculo, HistorialAsignacion.vehiculo_id == Vehiculo.id_vehiculo
        ).join(
            Conductor, HistorialAsignacion.conductor_id == Conductor.id_conductor
        ).join(
            conductor_usuario, Conductor.usuario_id == conductor_usuario.id_usuario
        ).join(
            coordinador_usuario, HistorialAsignacion.coordinador_id == coordinador_usuario.id_usuario
        ).join(
            caficultor_usuario, Entrega.caficultor_id == caficultor_usuario.id_usuario
        ).order_by(HistorialAsignacion.fecha_hora_asignacion.desc()).all()

    def conductor_tiene_viaje_activo(self, conductor_id: int, vehiculo_id: int) -> bool:
        return self.db.query(Vehiculo).filter(
            Vehiculo.conductor_id == conductor_id,
            Vehiculo.id_vehiculo != vehiculo_id,
            Vehiculo.estado_vehiculo == "en camino",
        ).first() is not None

    def asignar_vehiculo(self, entrega: Entrega, vehiculo: Vehiculo, conductor: Conductor, solicitud: Solicitud, carga: Carga, coordinador_id: int):
        # La carga representa el peso real que se transportará en esta entrega.
        carga.peso_kg = entrega.cantidad_kg
        carga.vehiculo_id = vehiculo.id_vehiculo
        vehiculo.conductor_id = conductor.id_conductor
        self.db.add(HistorialAsignacion(
            entrega_id=entrega.id_entrega,
            carga_id=carga.id_carga,
            vehiculo_id=vehiculo.id_vehiculo,
            conductor_id=conductor.id_conductor,
            coordinador_id=coordinador_id,
            fecha_hora_asignacion=datetime.now(),
        ))
        # La asignación no cambia el estado: el conductor debe reportarlo explícitamente.
        self.db.commit()
        self.db.refresh(entrega)
        return entrega
