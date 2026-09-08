from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.models.entrega_models import Entrega
from app.models.historial_asignacion_models import HistorialAsignacion
from app.models.mensaje_soporte_models import MensajeSoporte
from app.models.usuario_models import Usuario
from app.schemas.soporte_schemas import MensajeSoporteCreate


class SoporteService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _rol(usuario: Usuario) -> str:
        return usuario.rol.descripcion_rol.lower() if usuario.rol else ""

    def _asignacion_actual(self, entrega_id: UUID) -> HistorialAsignacion | None:
        return (
            self.db.query(HistorialAsignacion)
            .filter(HistorialAsignacion.entrega_id == entrega_id)
            .order_by(
                HistorialAsignacion.fecha_hora_asignacion.desc(),
                HistorialAsignacion.id_asignacion.desc(),
            )
            .first()
        )

    def _contexto_autorizado(self, entrega_id: UUID, usuario: Usuario):
        entrega = self.db.query(Entrega).filter(Entrega.id_entrega == entrega_id).first()
        asignacion = self._asignacion_actual(entrega_id)
        if entrega is None or asignacion is None:
            raise HTTPException(status_code=404, detail="La carga todavía no tiene un coordinador asignado")

        rol = self._rol(usuario)
        autorizado = (
            rol == "caficultor" and entrega.caficultor_id == usuario.id_usuario
        ) or (
            rol == "coordinador" and asignacion.coordinador_id == usuario.id_usuario
        )
        if not autorizado:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta conversación")

        caficultor = self.db.query(Usuario).filter(Usuario.id_usuario == entrega.caficultor_id).first()
        coordinador = self.db.query(Usuario).filter(Usuario.id_usuario == asignacion.coordinador_id).first()
        if caficultor is None or coordinador is None:
            raise HTTPException(status_code=409, detail="No fue posible identificar a los participantes")
        return entrega, asignacion, caficultor, coordinador

    @staticmethod
    def _nombre(usuario: Usuario | None, fallback: str = "Usuario") -> str:
        if usuario is None:
            return fallback
        return f"{usuario.nombre_usuario} {usuario.apellido}".strip()

    def listar_conversaciones(self, usuario: Usuario) -> list[dict]:
        rol = self._rol(usuario)
        asignaciones = (
            self.db.query(HistorialAsignacion)
            .join(Entrega, Entrega.id_entrega == HistorialAsignacion.entrega_id)
            .filter(
                Entrega.caficultor_id == usuario.id_usuario
                if rol == "caficultor"
                else HistorialAsignacion.coordinador_id == usuario.id_usuario
            )
            .order_by(HistorialAsignacion.fecha_hora_asignacion.desc())
            .all()
        )

        resultados = []
        procesadas = set()
        for candidata in asignaciones:
            if candidata.entrega_id in procesadas:
                continue
            procesadas.add(candidata.entrega_id)
            actual = self._asignacion_actual(candidata.entrega_id)
            # Si la carga se reasignó, la conversación pasa al coordinador actual.
            if rol == "coordinador" and actual.coordinador_id != usuario.id_usuario:
                continue
            entrega = self.db.query(Entrega).filter(Entrega.id_entrega == candidata.entrega_id).first()
            if entrega is None:
                continue
            caficultor = self.db.query(Usuario).filter(Usuario.id_usuario == entrega.caficultor_id).first()
            coordinador = self.db.query(Usuario).filter(Usuario.id_usuario == actual.coordinador_id).first()
            ultimo = (
                self.db.query(MensajeSoporte)
                .filter(MensajeSoporte.entrega_id == entrega.id_entrega)
                .order_by(MensajeSoporte.fecha_hora.desc())
                .first()
            )
            no_leidos = (
                self.db.query(MensajeSoporte)
                .filter(
                    MensajeSoporte.entrega_id == entrega.id_entrega,
                    MensajeSoporte.remitente_id != usuario.id_usuario,
                    MensajeSoporte.leido_en.is_(None),
                )
                .count()
            )
            resultados.append({
                "entrega_id": entrega.id_entrega,
                "carga_id": actual.carga_id,
                "estado_entrega": entrega.estado_entrega,
                "cantidad_kg": float(entrega.cantidad_kg),
                "caficultor_nombre": self._nombre(caficultor, "Caficultor"),
                "coordinador_nombre": self._nombre(coordinador, "Coordinador"),
                "fecha_asignacion": actual.fecha_hora_asignacion,
                "ultimo_mensaje": ultimo.mensaje if ultimo else None,
                "ultimo_mensaje_en": ultimo.fecha_hora if ultimo else None,
                "mensajes_no_leidos": no_leidos,
            })
        return resultados

    def listar_mensajes(self, entrega_id: UUID, usuario: Usuario) -> list[dict]:
        self._contexto_autorizado(entrega_id, usuario)
        ahora = utc_now_naive()
        self.db.query(MensajeSoporte).filter(
            MensajeSoporte.entrega_id == entrega_id,
            MensajeSoporte.remitente_id != usuario.id_usuario,
            MensajeSoporte.leido_en.is_(None),
        ).update({MensajeSoporte.leido_en: ahora}, synchronize_session=False)
        self.db.commit()

        mensajes = (
            self.db.query(MensajeSoporte)
            .filter(MensajeSoporte.entrega_id == entrega_id)
            .order_by(MensajeSoporte.fecha_hora.desc())
            .limit(500)
            .all()
        )
        mensajes.reverse()
        remitentes = {item.remitente_id for item in mensajes if item.remitente_id is not None}
        usuarios = {
            item.id_usuario: item
            for item in self.db.query(Usuario).filter(Usuario.id_usuario.in_(remitentes)).all()
        } if remitentes else {}
        return [{
            "id_mensaje": item.id_mensaje,
            "entrega_id": item.entrega_id,
            "remitente_id": item.remitente_id,
            "remitente_nombre": self._nombre(usuarios.get(item.remitente_id), "Usuario eliminado"),
            "mensaje": item.mensaje,
            "fecha_hora": item.fecha_hora,
            "leido": item.leido_en is not None,
            "es_propio": item.remitente_id == usuario.id_usuario,
        } for item in mensajes]

    def enviar_mensaje(self, entrega_id: UUID, datos: MensajeSoporteCreate, usuario: Usuario) -> dict:
        self._contexto_autorizado(entrega_id, usuario)
        contenido = datos.mensaje.strip()
        if not contenido:
            raise HTTPException(status_code=400, detail="Escribe un mensaje antes de enviarlo")
        mensaje = MensajeSoporte(
            entrega_id=entrega_id,
            remitente_id=usuario.id_usuario,
            mensaje=contenido,
            fecha_hora=utc_now_naive(),
        )
        self.db.add(mensaje)
        self.db.commit()
        self.db.refresh(mensaje)
        return {
            "id_mensaje": mensaje.id_mensaje,
            "entrega_id": mensaje.entrega_id,
            "remitente_id": mensaje.remitente_id,
            "remitente_nombre": self._nombre(usuario),
            "mensaje": mensaje.mensaje,
            "fecha_hora": mensaje.fecha_hora,
            "leido": False,
            "es_propio": True,
        }
