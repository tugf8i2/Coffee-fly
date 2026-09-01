from datetime import timezone
from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.solicitud_repositories import (
    SolicitudRepository
)

from app.schemas.solicitud_schemas import (
    SolicitudCreate,
    SolicitudUpdate,
    SincronizarSolicitudRequest,
)
from app.models.carga_models import Carga
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario


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

    @staticmethod
    def _rol(usuario: Usuario) -> str:
        return usuario.rol.descripcion_rol.lower() if usuario.rol else ""

    def _autorizar(self, solicitud: Solicitud, usuario: Usuario):
        if self._rol(usuario) == "coordinador":
            return solicitud
        if self._rol(usuario) == "caficultor" and solicitud.caficultor_id == usuario.id_usuario:
            return solicitud
        raise HTTPException(status_code=403, detail="No tienes acceso a esta solicitud")

    def _validar_carga_propia(self, carga_id: UUID | None, caficultor_id: int, solicitud_id: UUID | None = None):
        if carga_id is None:
            return
        carga = self.repository.db.query(Carga).filter(Carga.id_carga == carga_id).first()
        if carga is None or carga.caficultor_id != caficultor_id:
            raise HTTPException(status_code=403, detail="La carga no pertenece al caficultor autenticado")
        vinculada = self.repository.db.query(Solicitud).filter(Solicitud.carga_id == carga_id)
        if solicitud_id is not None:
            vinculada = vinculada.filter(Solicitud.id_solicitud != solicitud_id)
        if vinculada.first() is not None:
            raise HTTPException(status_code=409, detail="La carga ya está vinculada a otra solicitud")


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

    def obtener_solicitud(
        self,
        id_solicitud: UUID,
        usuario: Usuario,
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

        return self._autorizar(solicitud, usuario)


    def crear_solicitud(
        self,
        solicitud: SolicitudCreate,
        caficultor_id: int,
    ):
        self._validar_carga_propia(solicitud.carga_id, caficultor_id)
        return (
            self.repository
            .create_solicitud(
                solicitud
            )
        )

    def sincronizar_solicitud(self, datos: SincronizarSolicitudRequest, caficultor_id: int):
        existente = self.repository.db.query(Solicitud).filter(
            Solicitud.client_request_id == datos.client_request_id
        ).first()
        if existente is not None:
            if existente.caficultor_id != caficultor_id:
                raise HTTPException(status_code=409, detail="El identificador ya pertenece a otro caficultor")
            return {
                "client_request_id": datos.client_request_id,
                "solicitud_id": existente.id_solicitud,
                "carga_id": existente.carga_id,
                "estado": "duplicada",
            }

        captured_at = datos.capturada_en
        if captured_at.tzinfo is not None:
            captured_at = captured_at.astimezone(timezone.utc).replace(tzinfo=None)
        carga = Carga(
            peso_kg=datos.peso_kg,
            descripcion=datos.observacion.strip(),
            caficultor_id=caficultor_id,
            estado_sincronizacion="sincronizado",
            actualizado_en=captured_at,
        )
        solicitud = Solicitud(
            estado_solicitud="pendiente",
            fecha_hora_solicitud=captured_at,
            estado_sincronizacion="sincronizado",
            caficultor_id=caficultor_id,
            client_request_id=datos.client_request_id,
        )
        db = self.repository.db
        try:
            db.add(carga)
            db.flush()
            solicitud.carga_id = carga.id_carga
            db.add(solicitud)
            db.commit()
            db.refresh(solicitud)
        except Exception:
            db.rollback()
            repetida = db.query(Solicitud).filter(Solicitud.client_request_id == datos.client_request_id).first()
            if repetida is not None and repetida.caficultor_id == caficultor_id:
                return {
                    "client_request_id": datos.client_request_id,
                    "solicitud_id": repetida.id_solicitud,
                    "carga_id": repetida.carga_id,
                    "estado": "duplicada",
                }
            raise
        return {
            "client_request_id": datos.client_request_id,
            "solicitud_id": solicitud.id_solicitud,
            "carga_id": carga.id_carga,
            "estado": "registrada",
        }


    def actualizar_solicitud(
        self,
        id_solicitud: UUID,
        solicitud: SolicitudUpdate,
        usuario: Usuario,
    ):
        existente = self.repository.get_solicitud(id_solicitud)
        if existente is None:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        self._autorizar(existente, usuario)
        cambios = solicitud.model_dump(exclude_unset=True)
        if self._rol(usuario) == "caficultor":
            if existente.estado_solicitud != "pendiente":
                raise HTTPException(status_code=409, detail="Solo puedes modificar una solicitud pendiente")
            cambios.pop("caficultor_id", None)
            cambios.pop("estado_sincronizacion", None)
            if cambios.get("estado_solicitud", "pendiente") not in {"pendiente", "cancelado"}:
                raise HTTPException(status_code=403, detail="El caficultor solo puede cancelar una solicitud pendiente")
            carga_id = cambios.get("carga_id")
            if carga_id is not None:
                self._validar_carga_propia(carga_id, usuario.id_usuario, id_solicitud)
        solicitud_segura = SolicitudUpdate(**cambios)
        actualizada = (
            self.repository
            .update_solicitud(
                id_solicitud,
                solicitud_segura
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
        id_solicitud: UUID,
        usuario: Usuario,
    ):
        existente = self.repository.get_solicitud(id_solicitud)
        if existente is None:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        self._autorizar(existente, usuario)
        if self._rol(usuario) == "caficultor" and existente.estado_solicitud != "pendiente":
            raise HTTPException(status_code=409, detail="Solo puedes eliminar una solicitud pendiente")
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
