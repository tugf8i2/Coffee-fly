from datetime import date, datetime, time, timedelta

from fastapi import HTTPException

from app.models.entrega_models import Entrega
from app.repositories.entrega_repositories import EntregaRepository
from app.schemas.entrega_schemas import EntregaCreate


class EntregaService:
    def __init__(self, db):
        self.repository = EntregaRepository(db)

    def registrar(self, datos: EntregaCreate):
        solicitud = self.repository.get_solicitud_activa(datos.solicitud_id)
        if solicitud is None:
            raise HTTPException(status_code=400, detail="El caficultor debe tener una solicitud activa registrada")
        if self.repository.get_by_solicitud(datos.solicitud_id):
            raise HTTPException(status_code=409, detail="Esta solicitud ya tiene una entrega registrada")

        return self.repository.create(Entrega(
            solicitud_id=solicitud.id_solicitud,
            caficultor_id=solicitud.caficultor_id,
            cantidad_kg=datos.cantidad_kg,
            fecha_hora=datos.fecha_hora,
            observaciones=datos.observaciones,
            estado_entrega="Pendiente",
        ))

    def listar_del_dia(self, fecha: date | None = None):
        dia = fecha or datetime.now().date()
        inicio = datetime.combine(dia, time.min)
        fin = inicio + timedelta(days=1)
        registros = self.repository.get_del_dia(inicio, fin)
        return [
            {
                "id_entrega": entrega.id_entrega,
                "solicitud_id": entrega.solicitud_id,
                "caficultor_id": entrega.caficultor_id,
                "caficultor_nombre": f"{usuario.nombre_usuario} {usuario.apellido}",
                "cantidad_kg": float(entrega.cantidad_kg),
                "fecha_hora": entrega.fecha_hora,
                "observaciones": entrega.observaciones,
                "estado_entrega": entrega.estado_entrega,
            }
            for entrega, usuario in registros
        ]

    def listar_solicitudes_disponibles(self):
        return self.repository.get_solicitudes_disponibles()
