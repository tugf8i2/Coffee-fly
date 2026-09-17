from datetime import timezone
from math import isfinite
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
from app.models.entrega_models import Entrega
from app.models.conductor_models import Conductor
from app.models.viaje_models import Viaje
from app.models.historial_estado_entrega_models import HistorialEstadoEntrega
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario
from app.core.time import utc_now_naive


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

    @staticmethod
    def _fecha_captura(datos: SincronizarSolicitudRequest):
        capturada_en = datos.capturada_en
        if capturada_en.tzinfo is not None:
            capturada_en = capturada_en.astimezone(timezone.utc).replace(tzinfo=None)
        return capturada_en

    def _validar_reintento_sincronizacion(self, existente, datos, caficultor_id):
        if existente.caficultor_id != caficultor_id:
            raise HTTPException(status_code=409, detail="El identificador ya pertenece a otro caficultor")
        carga = existente.carga

        def numero(valor):
            return None if valor is None else round(float(valor), 2)

        coincide = carga is not None and all((
            numero(carga.peso_kg) == numero(datos.peso_total_kg),
            numero(carga.peso_bulto_kg) == numero(datos.peso_bulto_kg),
            carga.cantidad_bultos == datos.cantidad_bultos,
            numero(carga.peso_extra_kg or 0) == numero(datos.peso_extra_kg),
            carga.grupos_bultos == datos.grupos_bultos,
            (carga.descripcion or "").strip() == datos.observacion.strip(),
            existente.fecha_hora_solicitud == self._fecha_captura(datos),
        ))
        if not coincide:
            raise HTTPException(status_code=409, detail="El identificador de la solicitud ya fue usado con datos diferentes")
        return {
            "client_request_id": datos.client_request_id,
            "solicitud_id": existente.id_solicitud,
            "carga_id": existente.carga_id,
            "estado": "duplicada",
        }


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
        viaje_ids = {entrega.viaje_id for _, _, entrega in registros if entrega and entrega.viaje_id}
        conductor_por_viaje = dict(self.repository.db.query(Viaje.id_viaje, Viaje.conductor_id).filter(Viaje.id_viaje.in_(viaje_ids)).all()) if viaje_ids else {}
        conductor_ids = set(conductor_por_viaje.values())
        conductores = {
            conductor.id_conductor: usuario
            for conductor, usuario in self.repository.db.query(Conductor, Usuario).join(
                Usuario, Conductor.usuario_id == Usuario.id_usuario
            ).filter(Conductor.id_conductor.in_(conductor_ids)).all()
        } if conductor_ids else {}
        def conductor_asignado(entrega):
            return conductores.get(conductor_por_viaje.get(entrega.viaje_id)) if entrega else None
        solicitudes = [
            {
                "id_solicitud": str(solicitud.id_solicitud),
                "carga_id": str(carga.id_carga) if carga else None,
                "entrega_id": str(entrega.id_entrega) if entrega else None,
                "conductor_nombre": f"{conductor_asignado(entrega).nombre_usuario} {conductor_asignado(entrega).apellido}".strip() if conductor_asignado(entrega) else None,
                "conductor_foto_perfil": conductor_asignado(entrega).foto_perfil if conductor_asignado(entrega) else None,
                "estado_solicitud": solicitud.estado_solicitud,
                "fecha_hora_solicitud": solicitud.fecha_hora_solicitud,
                "estado_sincronizacion": solicitud.estado_sincronizacion,
                "peso_kg": float(carga.peso_kg) if carga and carga.peso_kg is not None else 0,
                "peso_bulto_kg": float(carga.peso_bulto_kg) if carga and carga.peso_bulto_kg is not None else None,
                "cantidad_bultos": carga.cantidad_bultos if carga else None,
                "peso_extra_kg": float(carga.peso_extra_kg or 0) if carga else 0,
                "grupos_bultos": carga.grupos_bultos if carga else None,
                "observacion": carga.descripcion if carga else None,
            }
            for solicitud, carga, entrega in registros
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
            return self._validar_reintento_sincronizacion(existente, datos, caficultor_id)

        caficultor = self.repository.db.query(Usuario).filter(Usuario.id_usuario == caficultor_id).first()
        latitud = getattr(caficultor, "latitud_finca", None)
        longitud = getattr(caficultor, "longitud_finca", None)
        if (
            latitud is None or longitud is None
            or not isfinite(float(latitud)) or not isfinite(float(longitud))
            or not -90 <= float(latitud) <= 90 or not -180 <= float(longitud) <= 180
        ):
            raise HTTPException(status_code=409, detail="Registra la ubicación de tu finca antes de solicitar una recolección")

        captured_at = self._fecha_captura(datos)
        carga = Carga(
            peso_kg=datos.peso_total_kg,
            peso_bulto_kg=datos.peso_bulto_kg,
            cantidad_bultos=datos.cantidad_bultos,
            peso_extra_kg=datos.peso_extra_kg,
            grupos_bultos=datos.grupos_bultos,
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
            if repetida is not None:
                return self._validar_reintento_sincronizacion(repetida, datos, caficultor_id)
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
        entrega_vinculada = self.repository.get_entrega_solicitud_for_update(
            existente.id_solicitud
        )
        if entrega_vinculada is not None:
            existente = self.repository.get_solicitud_for_update(existente.id_solicitud)
            if existente is None:
                raise HTTPException(status_code=404, detail="Solicitud no encontrada")
            self._autorizar(existente, usuario)
            es_cancelacion_previa = (
                entrega_vinculada.viaje_id is None
                and entrega_vinculada.estado_entrega == "pendiente"
                and existente.carga is not None
                and existente.carga.vehiculo_id is None
                and existente.estado_solicitud == "pendiente"
                and cambios == {"estado_solicitud": "cancelado"}
            )
            if not es_cancelacion_previa:
                raise HTTPException(status_code=409, detail="La solicitud registrada para transporte ya no permite modificaciones")
        if self._rol(usuario) == "caficultor":
            if existente.estado_solicitud != "pendiente":
                raise HTTPException(status_code=409, detail="Solo puedes modificar una solicitud pendiente")
            entrega_asignada = self.repository.db.query(Entrega.id_entrega).filter(
                Entrega.solicitud_id == existente.id_solicitud,
                Entrega.viaje_id.isnot(None),
            ).first()
            if entrega_asignada is not None:
                raise HTTPException(status_code=409, detail="La solicitud ya pertenece a un viaje asignado")
            cambios.pop("caficultor_id", None)
            cambios.pop("estado_sincronizacion", None)
            if cambios.get("estado_solicitud", "pendiente") not in {"pendiente", "cancelado"}:
                raise HTTPException(status_code=403, detail="El caficultor solo puede cancelar una solicitud pendiente")
            carga_id = cambios.get("carga_id")
            if carga_id is not None:
                self._validar_carga_propia(carga_id, usuario.id_usuario, id_solicitud)
        solicitud_segura = SolicitudUpdate(**cambios)
        if entrega_vinculada is not None and cambios.get("estado_solicitud") == "cancelado":
            ahora = utc_now_naive()
            self.repository.db.add(HistorialEstadoEntrega(
                entrega_id=entrega_vinculada.id_entrega,
                estado_anterior=entrega_vinculada.estado_entrega,
                estado_nuevo="cancelado",
                usuario_id=usuario.id_usuario,
                fecha_hora_cambio=ahora,
            ))
            entrega_vinculada.estado_entrega = "cancelado"
            entrega_vinculada.actualizado_en = ahora
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
        if self.repository.db.query(Entrega.id_entrega).filter(
            Entrega.solicitud_id == id_solicitud
        ).first() is not None:
            raise HTTPException(status_code=409, detail="La solicitud ya fue registrada para transporte y no puede eliminarse")
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
