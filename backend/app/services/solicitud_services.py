from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.solicitud_repositories import (
    SolicitudRepository
)

from app.schemas.solicitud_schemas import (
    SolicitudCreate,
    SolicitudUpdate
)


class SolicitudService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            SolicitudRepository(
                db
            )
        )


    def obtener_solicitudes(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_solicitudes(
                skip,
                limit
            )
        )

    def obtener_dashboard_caficultor(self, caficultor_id: int):
        registros = self.repository.get_solicitudes_por_caficultor(caficultor_id)
        solicitudes = [
            {
                "id_solicitud": str(solicitud.id_solicitud),
                "estado_solicitud": solicitud.estado_solicitud,
                "fecha_hora_solicitud": solicitud.fecha_hora_solicitud,
                "estado_sincronizacion": solicitud.estado_sincronizacion,
                "peso_kg": float(carga.peso_kg) if carga and carga.peso_kg is not None else 0,
                "observacion": carga.descripcion if carga else None,
            }
            for solicitud, carga in registros
        ]
        entregadas = [item for item in solicitudes if item["estado_solicitud"] == "entregado"]
        activas = [item for item in solicitudes if item["estado_solicitud"] in {"pendiente", "en camino"}]
        return {
            "resumen": {
                "total_solicitudes": len(solicitudes),
                "solicitudes_activas": len(activas),
                "despachos_entregados": len(entregadas),
                "kg_solicitados": round(sum(item["peso_kg"] for item in solicitudes), 2),
                "kg_despachados": round(sum(item["peso_kg"] for item in entregadas), 2),
            },
            "solicitudes_activas": activas,
            "historial_despachos": entregadas,
        }

    def obtener_seguimiento_caficultor(self, caficultor_id: int):
        registro = self.repository.get_seguimiento_por_caficultor(caficultor_id)
        if not registro:
            raise HTTPException(status_code=404, detail="No tienes una solicitud activa con vehículo asignado")
        solicitud, carga = registro
        # Ubicación simulada vigente hasta conectar un proveedor GPS real.
        return {
            "id_solicitud": str(solicitud.id_solicitud),
            "estado_solicitud": solicitud.estado_solicitud,
            "vehiculo_id": carga.vehiculo_id,
            "peso_kg": float(carga.peso_kg or 0),
            "ubicacion": {"latitud": 4.7110, "longitud": -74.0721, "actualizado_en": solicitud.fecha_hora_solicitud},
        }


    def obtener_solicitud(
        self,
        id_solicitud: UUID
    ):

        solicitud = (
            self.repository
            .get_solicitud(
                id_solicitud
            )
        )

        if solicitud is None:

            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada"
            )

        return solicitud


    def crear_solicitud(
        self,
        solicitud: SolicitudCreate
    ):

        return (
            self.repository
            .create_solicitud(
                solicitud
            )
        )


    def actualizar_solicitud(
        self,
        id_solicitud: UUID,
        solicitud: SolicitudUpdate
    ):

        actualizada = (
            self.repository
            .update_solicitud(
                id_solicitud,
                solicitud
            )
        )

        if actualizada is None:

            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada"
            )

        return actualizada


    def eliminar_solicitud(
        self,
        id_solicitud: UUID
    ):

        eliminada = (
            self.repository
            .delete_solicitud(
                id_solicitud
            )
        )

        if eliminada is None:

            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada"
            )

        return {
            "mensaje":
            "Solicitud eliminada"
        }
