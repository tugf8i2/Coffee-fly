from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.conductor_repositories import (
    ConductorRepository
)

from app.schemas.conductor_schemas import (
    ConductorCreate,
    ConductorUpdate
)
from app.models.conductor_models import Conductor
from app.models.usuario_models import Usuario
from app.models.cooperativa_models import Cooperativa
from app.services.compatibilidad_transporte import LICENCIAS_PERMITIDAS, hoy_colombia, viaje_reservado
from app.services.auditoria_operativa import registrar_auditoria
from app.core.time import utc_now_naive


class ConductorService:

    def __init__(self, db: Session):
        self.repository = ConductorRepository(db)


    def obtener_conductor(
        self,
        id_conductor: int
    ):

        conductor = self.repository.get_conductor(
            id_conductor
        )

        if conductor is None:
            raise HTTPException(
                status_code=404,
                detail="Conductor no encontrado"
            )

        return conductor


    def obtener_conductores(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return self.repository.get_conductores(
            skip,
            limit
        )


    def crear_conductor(
        self,
        conductor: ConductorCreate
    ):

        self._validar(conductor.model_dump())
        record = self.repository.create_conductor(conductor)
        registrar_auditoria(self.repository.db, "conductor", record.id_conductor, "crear", None,
                            despues=self._snapshot(record))
        self.repository.db.commit()
        return record


    def actualizar_conductor(
        self,
        id_conductor: int,
        conductor: ConductorUpdate
    ):

        actual = self.repository.get_conductor(id_conductor)
        if actual is None:
            raise HTTPException(status_code=404, detail="Conductor no encontrado")
        if viaje_reservado(self.repository.db, conductor_id=id_conductor):
            raise HTTPException(status_code=409, detail="No se puede modificar un conductor con viaje asignado o en ruta")
        antes = self._snapshot(actual)
        self._validar({**{key: getattr(actual, key) for key in ("licencia", "numero_licencia", "fecha_expedicion_licencia", "fecha_vencimiento_licencia", "cooperativa_id")},
                       **conductor.model_dump(exclude_unset=True)})
        conductor_actualizado = (
            self.repository.update_conductor(
                id_conductor,
                conductor
            )
        )
        conductor_actualizado.actualizado_en = utc_now_naive()
        registrar_auditoria(self.repository.db, "conductor", id_conductor, "actualizar", None,
                            antes, self._snapshot(conductor_actualizado))
        self.repository.db.commit()

        if conductor_actualizado is None:
            raise HTTPException(
                status_code=404,
                detail="Conductor no encontrado"
            )

        return conductor_actualizado

    def _validar(self, data):
        if not data.get("foto_licencia"):
            raise HTTPException(status_code=400, detail="La foto de licencia es obligatoria")
        if data.get("licencia") not in LICENCIAS_PERMITIDAS:
            raise HTTPException(status_code=400, detail="Categoría de licencia no válida")
        if not data.get("numero_licencia") or not data.get("fecha_vencimiento_licencia"):
            raise HTTPException(status_code=400, detail="Número y vencimiento de licencia son obligatorios")
        if data["fecha_vencimiento_licencia"] < hoy_colombia():
            raise HTTPException(status_code=400, detail="La licencia está vencida")
        if data.get("fecha_expedicion_licencia") and data["fecha_expedicion_licencia"] > data["fecha_vencimiento_licencia"]:
            raise HTTPException(status_code=400, detail="Fechas de licencia inconsistentes")
        if data.get("cooperativa_id") and not self.repository.db.get(Cooperativa, data["cooperativa_id"]):
            raise HTTPException(status_code=400, detail="Cooperativa no encontrada")

    @staticmethod
    def _snapshot(record):
        return {"licencia": record.licencia, "numero_licencia": record.numero_licencia,
                "fecha_vencimiento_licencia": record.fecha_vencimiento_licencia.isoformat() if record.fecha_vencimiento_licencia else None,
                "estado_conductor": record.estado_conductor}


    def eliminar_conductor(
        self,
        id_conductor: int
    ):

        conductor = (
            self.repository.delete_conductor(
                id_conductor
            )
        )

        if conductor is None:
            raise HTTPException(
                status_code=404,
                detail="Conductor no encontrado"
            )

        return {
            "mensaje": "Conductor eliminado"
        }
