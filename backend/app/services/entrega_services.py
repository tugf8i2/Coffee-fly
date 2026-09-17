from datetime import datetime, timedelta
from math import asin, cos, hypot, isfinite, radians, sin, sqrt
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entrega_models import Entrega
from app.models.cooperativa_models import Cooperativa
from app.models.historial_eventos_models import HistorialEvento
from app.models.historial_estado_entrega_models import HistorialEstadoEntrega
from app.models.seguimiento_ubicacion_models import SeguimientoUbicacion
from app.models.viaje_models import Viaje
from app.core.time import as_utc_aware, to_utc_naive, utc_now_naive
from app.core.config import EVENT_RETENTION_DAYS
from app.core.observability import logger, process_metrics
from app.repositories.entrega_repositories import EntregaRepository
from app.repositories.cola_viajes import renumerar_cola_vehiculo
from app.schemas.entrega_schemas import EntregaCreate, RegistrarUbicacionRequest, SincronizarUbicacionesRequest


MAX_PRECISION_METROS = 150
MAX_VELOCIDAD_METROS_SEGUNDO = 60
DISTANCIA_DUPLICADO_METROS = 5
VENTANA_DUPLICADO_SEGUNDOS = 20
RADIO_CONFIRMACION_CARGA_METROS = 250
RADIO_CONFIRMACION_COOPERATIVA_METROS = 250
MAX_ANTIGUEDAD_CONFIRMACION_SEGUNDOS = 300
TOLERANCIA_FUTURO_GEOCERCA_SEGUNDOS = 30


def _fecha_utc_sin_zona(fecha: datetime) -> datetime:
    return to_utc_naive(fecha)


def _distancia_metros(latitud_a: float, longitud_a: float, latitud_b: float, longitud_b: float) -> float:
    radio_tierra = 6_371_000
    delta_latitud = radians(latitud_b - latitud_a)
    delta_longitud = radians(longitud_b - longitud_a)
    valor = sin(delta_latitud / 2) ** 2 + cos(radians(latitud_a)) * cos(radians(latitud_b)) * sin(delta_longitud / 2) ** 2
    return 2 * radio_tierra * asin(sqrt(min(1.0, max(0.0, valor))))


def _distancia_efectiva_metros(
    latitud_a: float,
    longitud_a: float,
    precision_a: float | None,
    latitud_b: float,
    longitud_b: float,
    precision_b: float | None,
) -> float:
    distancia = _distancia_metros(latitud_a, longitud_a, latitud_b, longitud_b)
    incertidumbre = hypot(float(precision_a or 0), float(precision_b or 0))
    return max(0.0, distancia - incertidumbre)


def _distancia_efectiva_puntos(punto_a, punto_b) -> float:
    return _distancia_efectiva_metros(
        float(punto_a.latitud), float(punto_a.longitud), getattr(punto_a, "precision_m", None),
        float(punto_b.latitud), float(punto_b.longitud), getattr(punto_b, "precision_m", None),
    )


def _distancia_trayecto(puntos) -> float:
    return sum(
        _distancia_efectiva_puntos(anterior, actual)
        for anterior, actual in zip(puntos, puntos[1:])
    )


class EntregaService:
    def __init__(self, db: Session):
        self.repository = EntregaRepository(db)

    def obtener_entregas(self, skip: int = 0, limit: int = 100):
        return self.repository.get_entregas(skip, limit)

    @staticmethod
    def _guardar_snapshot_finca(entrega, caficultor, requerido=True):
        latitud_snapshot = entrega.finca_latitud_snapshot
        longitud_snapshot = entrega.finca_longitud_snapshot
        if latitud_snapshot is not None and longitud_snapshot is not None:
            return False
        if latitud_snapshot is not None or longitud_snapshot is not None:
            raise HTTPException(status_code=409, detail="La entrega tiene un snapshot de finca incompleto")
        latitud = getattr(caficultor, "latitud_finca", None)
        longitud = getattr(caficultor, "longitud_finca", None)
        if (
            latitud is None or longitud is None
            or not isfinite(float(latitud)) or not isfinite(float(longitud))
            or not -90 <= float(latitud) <= 90 or not -180 <= float(longitud) <= 180
        ):
            if requerido:
                raise HTTPException(status_code=400, detail="El caficultor no tiene coordenadas de finca válidas")
            return False
        entrega.finca_latitud_snapshot = float(latitud)
        entrega.finca_longitud_snapshot = float(longitud)
        entrega.finca_direccion_snapshot = ", ".join(filter(None, [
            getattr(caficultor, "direccion_finca", None),
            getattr(caficultor, "vereda", None),
            getattr(caficultor, "municipio", None),
            getattr(caficultor, "departamento", None),
        ])) or None
        entrega.finca_ubicacion_snapshot_en = getattr(caficultor, "ubicacion_finca_actualizada_en", None) or utc_now_naive()
        return True

    @classmethod
    def _guardar_snapshot_cooperativa(cls, viaje, cooperativa, requerido=True):
        latitud_snapshot = viaje.cooperativa_latitud_snapshot
        longitud_snapshot = viaje.cooperativa_longitud_snapshot
        if latitud_snapshot is not None and longitud_snapshot is not None:
            return False
        if latitud_snapshot is not None or longitud_snapshot is not None:
            raise HTTPException(status_code=409, detail="El viaje tiene un snapshot de cooperativa incompleto")
        try:
            latitud, longitud = cls._coordenadas_cooperativa(cooperativa)
        except HTTPException:
            if requerido:
                raise
            return False
        ubicacion = cooperativa.ubicacion
        viaje.cooperativa_latitud_snapshot = latitud
        viaje.cooperativa_longitud_snapshot = longitud
        viaje.cooperativa_direccion_snapshot = ", ".join(filter(None, [
            getattr(cooperativa, "nombre", None),
            getattr(ubicacion, "direccion", None),
            getattr(ubicacion, "ciudad", None),
            getattr(ubicacion, "departamento", None),
        ])) or None
        return True

    @staticmethod
    def _coordenadas_cooperativa(cooperativa):
        ubicacion = cooperativa.ubicacion if cooperativa else None
        latitud = getattr(ubicacion, "y", None)
        longitud = getattr(ubicacion, "x", None)
        if (
            latitud is None or longitud is None
            or not isfinite(float(latitud)) or not isfinite(float(longitud))
            or not -90 <= float(latitud) <= 90 or not -180 <= float(longitud) <= 180
        ):
            raise HTTPException(status_code=400, detail="La cooperativa seleccionada no tiene coordenadas válidas")
        return float(latitud), float(longitud)

    def _recuperar_snapshots_legacy(self, entrega_id, entrega):
        viaje = self.repository.bloquear_viaje(entrega.viaje_id) if entrega.viaje_id else None
        registro = self.repository.get_vehiculo_entrega(entrega_id, for_update=True)
        if not registro:
            raise HTTPException(status_code=404, detail="Entrega con vehículo asignado no encontrada")
        entrega, vehiculo = registro
        cambio = self._guardar_snapshot_finca(entrega, entrega.caficultor, requerido=False)
        if viaje is not None:
            carga = entrega.solicitud.carga if entrega.solicitud else None
            cooperativa = carga.cooperativa if carga else None
            cambio = self._guardar_snapshot_cooperativa(
                viaje, cooperativa, requerido=False
            ) or cambio
        if cambio:
            self.repository.db.commit()
        return entrega, vehiculo, viaje

    def obtener_historial(self, usuario, fecha_desde, fecha_hasta, caficultor_id, estado, vehiculo_id, pagina):
        if fecha_desde and fecha_hasta and fecha_hasta < fecha_desde:
            raise HTTPException(status_code=400, detail="La fecha final debe ser posterior a la inicial")
        if fecha_desde and fecha_hasta and fecha_hasta - fecha_desde > timedelta(days=90):
            raise HTTPException(status_code=400, detail="El rango máximo de consulta es de 90 días")
        role = usuario.rol.descripcion_rol.lower() if usuario.rol else ""
        if role == "caficultor":
            caficultor_id = usuario.id_usuario
        filas, total = self.repository.get_historial_filtrado(
            fecha_desde, fecha_hasta, caficultor_id, estado, vehiculo_id, (pagina - 1) * 20, 20
        )
        return {
            "items": [{
                "id_entrega": entrega.id_entrega,
                "solicitud_id": entrega.solicitud_id,
                "caficultor_id": entrega.caficultor_id,
                "caficultor_nombre": f"{caficultor.nombre_usuario} {caficultor.apellido}".strip(),
                "cantidad_kg": float(entrega.cantidad_kg),
                "fecha_hora_entrega": entrega.fecha_hora_entrega,
                "observaciones": entrega.observaciones,
                "estado_entrega": entrega.estado_entrega,
                "vehiculo_id": vehiculo.id_vehiculo if vehiculo else None,
                "vehiculo_placa": vehiculo.placa if vehiculo else None,
            } for entrega, caficultor, vehiculo in filas],
            "total": total, "pagina": pagina, "tamano_pagina": 20,
        }

    def _contexto_gps(self, entrega_id: UUID, conductor_id: int):
        registro = self.repository.get_vehiculo_entrega(entrega_id)
        if not registro:
            raise HTTPException(status_code=404, detail="Entrega con vehículo asignado no encontrada")
        entrega, vehiculo = registro
        # Viaje siempre se bloquea antes que entrega, igual que en completar(),
        # y serializa puntos enviados desde cargas distintas del mismo viaje.
        viaje = None
        if entrega.viaje_id:
            viaje = self.repository.bloquear_viaje(entrega.viaje_id)
            if viaje is None:
                raise HTTPException(status_code=409, detail="El viaje de la entrega ya no está disponible")
            if viaje.estado_viaje != "en_camino":
                raise HTTPException(status_code=409, detail="El GPS solo puede actualizarse durante el viaje activo")
            registro = self.repository.get_vehiculo_entrega(entrega_id, for_update=True)
            if not registro:
                raise HTTPException(status_code=409, detail="La entrega ya no está disponible")
            entrega, vehiculo = registro
        else:
            registro = self.repository.get_vehiculo_entrega(entrega_id, for_update=True)
            if not registro:
                raise HTTPException(status_code=409, detail="La entrega ya no está disponible")
            entrega, vehiculo = registro
        conductor_asignado = entrega.viaje.conductor_id if entrega.viaje_id else vehiculo.conductor_id
        if conductor_asignado != conductor_id:
            raise HTTPException(status_code=403, detail="Solo el conductor asignado puede enviar la ubicación")
        if entrega.estado_entrega != "en camino":
            raise HTTPException(status_code=400, detail="El GPS solo puede actualizarse cuando la entrega está en camino")
        return entrega, vehiculo, viaje

    @staticmethod
    def _rechazar_punto(entrega_id: UUID, punto: RegistrarUbicacionRequest, detail: str):
        process_metrics.increment("gps_points_rejected")
        logger.warning(
            "gps_point_rejected",
            extra={
                "delivery_id": str(entrega_id),
                "client_point_id": str(punto.client_point_id),
                "reason": detail,
            },
        )
        raise HTTPException(status_code=422, detail=detail)

    @staticmethod
    def _distancia_acumulada(entrega, viaje=None):
        valor = getattr(viaje, "distancia_recorrida_m", 0) if viaje is not None else getattr(entrega, "distancia_recorrida_m", 0)
        return float(valor or 0)

    def _registrar_punto_validado(self, entrega, vehiculo, punto: RegistrarUbicacionRequest, commit: bool = True, viaje=None):
        entrega_id = entrega.id_entrega
        existente = self.repository.get_ubicacion_por_client_point_id(punto.client_point_id)
        if existente:
            mismo_contexto = (
                getattr(entrega, "viaje_id", None) is not None
                and existente.viaje_id == entrega.viaje_id
            ) or (
                getattr(entrega, "viaje_id", None) is None
                and existente.entrega_id == entrega_id
            )
            if not mismo_contexto:
                raise HTTPException(status_code=409, detail="El identificador del punto ya pertenece a otro viaje o entrega")
            return {
                "estado": "duplicado", "id_ubicacion": existente.id_ubicacion,
                "client_point_id": existente.client_point_id,
                "registrada_en": as_utc_aware(existente.registrada_en),
                "distancia_recorrida_m": self._distancia_acumulada(entrega, viaje),
            }

        if punto.precision_m is not None and punto.precision_m > MAX_PRECISION_METROS:
            self._rechazar_punto(
                entrega_id,
                punto,
                f"Punto descartado: precisión insuficiente ({punto.precision_m:.0f} m; máximo {MAX_PRECISION_METROS} m)",
            )
        if punto.velocidad_m_s is not None and punto.velocidad_m_s > MAX_VELOCIDAD_METROS_SEGUNDO:
            self._rechazar_punto(
                entrega_id, punto, "Punto descartado: velocidad reportada físicamente improbable"
            )

        ahora = utc_now_naive()
        capturada_en = _fecha_utc_sin_zona(punto.capturada_en) if punto.capturada_en else ahora
        if capturada_en > ahora + timedelta(minutes=5):
            self._rechazar_punto(entrega_id, punto, "Punto descartado: la hora de captura está en el futuro")

        anterior, siguiente = (
            self.repository.get_puntos_vecinos_viaje(entrega.viaje_id, capturada_en)
            if entrega.viaje_id else self.repository.get_puntos_vecinos(entrega_id, capturada_en)
        )
        for vecino in (anterior, siguiente):
            if vecino is None:
                continue
            distancia = _distancia_metros(
                float(vecino.latitud), float(vecino.longitud), punto.latitud, punto.longitud
            )
            segundos = abs((capturada_en - vecino.registrada_en).total_seconds())
            if distancia <= DISTANCIA_DUPLICADO_METROS and segundos <= VENTANA_DUPLICADO_SEGUNDOS:
                return {
                    "estado": "duplicado", "id_ubicacion": vecino.id_ubicacion,
                    "client_point_id": punto.client_point_id,
                    "registrada_en": as_utc_aware(vecino.registrada_en),
                    "distancia_recorrida_m": self._distancia_acumulada(entrega, viaje),
                }
            if segundos == 0:
                self._rechazar_punto(
                    entrega_id,
                    punto,
                    "Punto descartado: dos posiciones incompatibles tienen la misma hora de captura",
                )
            distancia_efectiva = _distancia_efectiva_metros(
                float(vecino.latitud), float(vecino.longitud), getattr(vecino, "precision_m", None),
                punto.latitud, punto.longitud, punto.precision_m,
            )
            if segundos > 0 and distancia_efectiva / segundos > MAX_VELOCIDAD_METROS_SEGUNDO:
                self._rechazar_punto(
                    entrega_id, punto, "Punto descartado: salto de ubicación físicamente improbable"
                )

        delta_distancia = 0.0
        if anterior is not None:
            delta_distancia += _distancia_efectiva_metros(
                float(anterior.latitud), float(anterior.longitud), getattr(anterior, "precision_m", None),
                punto.latitud, punto.longitud, punto.precision_m,
            )
        if siguiente is not None:
            delta_distancia += _distancia_efectiva_metros(
                punto.latitud, punto.longitud, punto.precision_m,
                float(siguiente.latitud), float(siguiente.longitud), getattr(siguiente, "precision_m", None),
            )
        if anterior is not None and siguiente is not None:
            delta_distancia -= _distancia_efectiva_puntos(anterior, siguiente)
        distancia_acumulada = max(0.0, self._distancia_acumulada(entrega, viaje) + delta_distancia)
        if viaje is not None:
            viaje.distancia_recorrida_m = distancia_acumulada
        else:
            entrega.distancia_recorrida_m = distancia_acumulada

        ubicacion = self.repository.registrar_ubicacion(SeguimientoUbicacion(
            client_point_id=punto.client_point_id,
            entrega_id=entrega.id_entrega, viaje_id=getattr(entrega, "viaje_id", None),
            vehiculo_id=vehiculo.id_vehiculo,
            latitud=punto.latitud, longitud=punto.longitud,
            precision_m=punto.precision_m, velocidad_m_s=punto.velocidad_m_s,
            rumbo_grados=punto.rumbo_grados, registrada_en=capturada_en, recibida_en=ahora,
        ), commit=commit)
        return {
            "estado": "guardado", "id_ubicacion": ubicacion.id_ubicacion,
            "client_point_id": ubicacion.client_point_id,
            "registrada_en": as_utc_aware(ubicacion.registrada_en),
            "distancia_recorrida_m": distancia_acumulada,
        }

    def registrar_ubicacion(self, entrega_id: UUID, punto: RegistrarUbicacionRequest, conductor_id: int):
        entrega, vehiculo, viaje = self._contexto_gps(entrega_id, conductor_id)
        result = self._registrar_punto_validado(entrega, vehiculo, punto, viaje=viaje)
        process_metrics.increment(
            "gps_points_saved" if result["estado"] == "guardado" else "gps_points_duplicate"
        )
        return result

    def sincronizar_ubicaciones(self, entrega_id: UUID, lote: SincronizarUbicacionesRequest, conductor_id: int):
        entrega, vehiculo, viaje = self._contexto_gps(entrega_id, conductor_id)
        puntos = sorted(
            lote.puntos,
            key=lambda item: _fecha_utc_sin_zona(item.capturada_en) if item.capturada_en else datetime.min,
        )
        resultados = []
        guardados = 0
        duplicados = 0
        rechazados = 0
        try:
            for punto in puntos:
                try:
                    resultado = self._registrar_punto_validado(
                        entrega, vehiculo, punto, commit=False, viaje=viaje
                    )
                    guardados += int(resultado["estado"] == "guardado")
                    duplicados += int(resultado["estado"] == "duplicado")
                    resultados.append(resultado)
                except HTTPException as error:
                    if error.status_code not in {400, 409, 422}:
                        raise
                    rechazados += 1
                    resultados.append({
                        "client_point_id": punto.client_point_id,
                        "estado": "rechazado",
                        "detalle": error.detail,
                    })
            self.repository.confirmar_ubicaciones()
            process_metrics.increment("gps_points_saved", guardados)
            process_metrics.increment("gps_points_duplicate", duplicados)
        except Exception:
            self.repository.revertir_ubicaciones()
            raise
        return {
            "recibidos": len(puntos),
            "guardados": guardados,
            "duplicados": duplicados,
            "rechazados": rechazados,
            "resultados": resultados,
            "distancia_recorrida_m": self._distancia_acumulada(entrega, viaje),
        }

    def obtener_seguimiento(self, entrega_id: UUID, usuario):
        registro = self.repository.get_vehiculo_entrega(entrega_id)
        if not registro:
            raise HTTPException(status_code=404, detail="Entrega con vehículo asignado no encontrada")
        entrega, vehiculo = registro
        role = usuario.rol.descripcion_rol.lower() if usuario.rol else ""
        if role == "caficultor" and entrega.caficultor_id != usuario.id_usuario:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta entrega")
        conductor_asignado = entrega.viaje.conductor_id if entrega.viaje_id else vehiculo.conductor_id
        if role == "conductor" and (not usuario.conductor or conductor_asignado != usuario.conductor.id_conductor):
            raise HTTPException(status_code=403, detail="No tienes acceso a esta entrega")
        entrega, vehiculo, viaje_bloqueado = self._recuperar_snapshots_legacy(
            entrega_id, entrega
        )
        puntos, total_puntos = (
            self.repository.get_puntos_ruta_viaje(entrega.viaje_id)
            if entrega.viaje_id else self.repository.get_puntos_ruta(entrega_id)
        )
        carga = entrega.solicitud.carga if entrega.solicitud else None
        cooperativa = carga.cooperativa if carga else None
        ubicacion_cooperativa = cooperativa.ubicacion if cooperativa else None
        recoleccion_latitud = entrega.finca_latitud_snapshot
        recoleccion_longitud = entrega.finca_longitud_snapshot
        recoleccion = ", ".join(filter(None, [
            f"{entrega.caficultor.nombre_usuario} {entrega.caficultor.apellido}".strip() if entrega.caficultor else None,
            entrega.finca_direccion_snapshot,
        ]))
        cooperativa_destino = ", ".join(filter(None, [
            cooperativa.nombre if cooperativa else None,
            ubicacion_cooperativa.direccion if ubicacion_cooperativa else None,
            ubicacion_cooperativa.ciudad if ubicacion_cooperativa else None,
            ubicacion_cooperativa.departamento if ubicacion_cooperativa else None,
        ]))
        viaje = viaje_bloqueado or entrega.viaje
        conductor = self.repository.get_conductor(conductor_asignado) if conductor_asignado else None
        conductor_usuario = conductor.usuarios if conductor else None
        cooperativa_latitud = getattr(viaje, "cooperativa_latitud_snapshot", None)
        cooperativa_longitud = getattr(viaje, "cooperativa_longitud_snapshot", None)
        if not entrega.viaje_id and cooperativa_latitud is None and ubicacion_cooperativa and ubicacion_cooperativa.y is not None:
            cooperativa_latitud = float(ubicacion_cooperativa.y)
        if not entrega.viaje_id and cooperativa_longitud is None and ubicacion_cooperativa and ubicacion_cooperativa.x is not None:
            cooperativa_longitud = float(ubicacion_cooperativa.x)
        if entrega.viaje_id:
            cooperativa_destino = getattr(viaje, "cooperativa_direccion_snapshot", None)
        hacia_cooperativa = entrega.carga_recogida_en is not None
        destino = cooperativa_destino if hacia_cooperativa else recoleccion
        destino_latitud = cooperativa_latitud if hacia_cooperativa else recoleccion_latitud
        destino_longitud = cooperativa_longitud if hacia_cooperativa else recoleccion_longitud
        ultimo = puntos[-1] if puntos else None
        distancia_recoleccion = None
        if ultimo and recoleccion_latitud is not None and recoleccion_longitud is not None:
            distancia_recoleccion = _distancia_metros(
                float(ultimo.latitud), float(ultimo.longitud), recoleccion_latitud, recoleccion_longitud
            )
        antiguedad_ultimo = (
            (utc_now_naive() - to_utc_naive(ultimo.registrada_en)).total_seconds()
            if ultimo else None
        )
        ubicacion_reciente = bool(
            antiguedad_ultimo is not None
            and -TOLERANCIA_FUTURO_GEOCERCA_SEGUNDOS <= antiguedad_ultimo <= MAX_ANTIGUEDAD_CONFIRMACION_SEGUNDOS
            and ultimo.precision_m is not None
            and float(ultimo.precision_m) <= MAX_PRECISION_METROS
        )
        distancia_viaje = self._distancia_acumulada(
            entrega, viaje if entrega.viaje_id else None
        )
        return {
            "entrega_id": entrega.id_entrega, "estado_entrega": entrega.estado_entrega,
            "vehiculo_id": vehiculo.id_vehiculo, "vehiculo_placa": vehiculo.placa,
            "conductor_nombre": f"{conductor_usuario.nombre_usuario} {conductor_usuario.apellido}".strip() if conductor_usuario else None,
            "conductor_foto_perfil": conductor_usuario.foto_perfil if conductor_usuario else None,
            "destino": destino,
            "destino_latitud": destino_latitud,
            "destino_longitud": destino_longitud,
            "destino_actualizado_en": entrega.finca_ubicacion_snapshot_en,
            "etapa_viaje": "hacia_cooperativa" if hacia_cooperativa else "hacia_finca",
            "carga_recogida_en": entrega.carga_recogida_en,
            "recoleccion": recoleccion,
            "recoleccion_latitud": recoleccion_latitud,
            "recoleccion_longitud": recoleccion_longitud,
            "cooperativa_nombre": cooperativa.nombre if cooperativa else None,
            "cooperativa_destino": cooperativa_destino or None,
            "cooperativa_latitud": cooperativa_latitud,
            "cooperativa_longitud": cooperativa_longitud,
            "distancia_recoleccion_m": distancia_recoleccion,
            "radio_confirmacion_m": RADIO_CONFIRMACION_CARGA_METROS,
            "puede_confirmar_carga": bool(
                entrega.estado_entrega == "en camino"
                and not hacia_cooperativa
                and ubicacion_reciente
                and distancia_recoleccion is not None
                and distancia_recoleccion <= RADIO_CONFIRMACION_CARGA_METROS
            ),
            "total_puntos": total_puntos,
            "ruta_truncada": total_puntos > len(puntos),
            "distancia_recorrida_m": distancia_viaje,
            "puntos": [{
                "client_point_id": item.client_point_id,
                "latitud": float(item.latitud), "longitud": float(item.longitud),
                "registrada_en": as_utc_aware(item.registrada_en), "precision_m": item.precision_m,
                "velocidad_m_s": item.velocidad_m_s, "rumbo_grados": item.rumbo_grados,
            }
                       for item in puntos],
        }

    def obtener_mi_seguimiento(self, caficultor_id: int, usuario):
        entrega = self.repository.get_entrega_activa_caficultor(caficultor_id)
        if not entrega:
            raise HTTPException(status_code=404, detail="No tienes una entrega activa con vehículo asignado")
        return self.obtener_seguimiento(entrega.id_entrega, usuario)

    def obtener_solicitudes_activas(self):
        registros = self.repository.get_solicitudes_activas()
        return [
            {
                "id_solicitud": solicitud.id_solicitud,
                "caficultor_id": solicitud.caficultor_id,
                "caficultor_nombre": f"{usuario.nombre_usuario} {usuario.apellido}".strip(),
                "fecha_hora_solicitud": solicitud.fecha_hora_solicitud,
                "cantidad_solicitada_kg": float(carga.peso_kg) if carga and carga.peso_kg is not None else 0,
                "peso_bulto_kg": float(carga.peso_bulto_kg) if carga and carga.peso_bulto_kg is not None else None,
                "cantidad_bultos": carga.cantidad_bultos if carga else None,
                "peso_extra_kg": float(carga.peso_extra_kg or 0) if carga else 0,
                "grupos_bultos": carga.grupos_bultos if carga else None,
            }
            for solicitud, usuario, carga in registros
        ]

    def crear_entrega(self, datos: EntregaCreate):
        solicitud = self.repository.get_solicitud_disponible(datos.solicitud_id)
        if solicitud is None or solicitud.carga is None:
            raise HTTPException(
                status_code=400,
                detail="La solicitud ya fue registrada o asignada, o no está pendiente de recolección",
            )
        cantidad_kg = float(solicitud.carga.peso_kg or 0)
        if cantidad_kg <= 0:
            raise HTTPException(status_code=400, detail="La solicitud no tiene un peso de carga válido")

        entrega = Entrega(
            solicitud_id=solicitud.id_solicitud,
            caficultor_id=solicitud.caficultor_id,
            # El peso siempre procede de la carga creada en la solicitud.
            cantidad_kg=cantidad_kg,
            fecha_hora_entrega=datos.fecha_hora_entrega,
            observaciones=datos.observaciones,
            estado_entrega="pendiente", actualizado_en=utc_now_naive(),
        )
        self._guardar_snapshot_finca(entrega, solicitud.caficultor)
        return self.repository.create_entrega(entrega)

    def cancelar_recoleccion(self, entrega_id: UUID, coordinador_id: int):
        db = self.repository.db
        referencia = db.query(Entrega.viaje_id).filter(Entrega.id_entrega == entrega_id).first()
        if referencia is None:
            raise HTTPException(status_code=404, detail="Recolección no encontrada")

        viaje = None
        if referencia[0] is not None:
            viaje = db.query(Viaje).filter(Viaje.id_viaje == referencia[0]).with_for_update().first()
        entrega = db.query(Entrega).filter(Entrega.id_entrega == entrega_id).with_for_update().first()
        if entrega is None:
            raise HTTPException(status_code=404, detail="Recolección no encontrada")
        if entrega.estado_entrega != "pendiente" or entrega.carga_recogida_en is not None:
            raise HTTPException(status_code=409, detail="Solo puedes cancelar una recolección pendiente que aún no fue recogida")
        if viaje is not None and viaje.estado_viaje not in {"asignado", "en_cola"}:
            raise HTTPException(status_code=409, detail="El viaje ya inició; la recolección no puede cancelarse")

        ahora = utc_now_naive()
        solicitud = entrega.solicitud
        carga = solicitud.carga if solicitud else None
        db.add(HistorialEstadoEntrega(
            entrega_id=entrega.id_entrega,
            estado_anterior=entrega.estado_entrega,
            estado_nuevo="cancelado",
            usuario_id=coordinador_id,
            fecha_hora_cambio=ahora,
        ))
        entrega.estado_entrega = "cancelado"
        entrega.actualizado_en = ahora
        entrega.viaje_id = None
        entrega.orden_recoleccion = None
        if solicitud is not None:
            solicitud.estado_solicitud = "cancelado"
        if carga is not None:
            carga.vehiculo_id = None
            carga.cooperativa_id = None

        if viaje is not None:
            restantes = db.query(Entrega).filter(
                Entrega.viaje_id == viaje.id_viaje,
                Entrega.id_entrega != entrega.id_entrega,
                Entrega.estado_entrega == "pendiente",
            ).order_by(Entrega.orden_recoleccion).with_for_update().all()
            for orden, restante in enumerate(restantes, 1):
                restante.orden_recoleccion = orden
            if not restantes:
                viaje.estado_viaje = "cancelado"
                db.flush()
                renumerar_cola_vehiculo(db, viaje.vehiculo_id)
        db.commit()
        db.refresh(entrega)
        return entrega

    def obtener_pendientes_asignacion(self):
        return [
            {
                "id_entrega": entrega.id_entrega,
                "caficultor_nombre": f"{usuario.nombre_usuario} {usuario.apellido}".strip(),
                "cantidad_kg": float(entrega.cantidad_kg),
                "fecha_hora_entrega": entrega.fecha_hora_entrega,
                "observaciones": entrega.observaciones,
            }
            for entrega, usuario, _solicitud, _carga in self.repository.get_entregas_pendientes_asignacion()
        ]

    def obtener_vehiculos_disponibles(self):
        result = []
        for vehiculo, carga_actual_value in self.repository.get_vehiculos_disponibles_con_carga():
            carga_actual = float(carga_actual_value or 0)
            result.append({
                "id_vehiculo": vehiculo.id_vehiculo,
                "placa": vehiculo.placa,
                "tipo_vehiculo": vehiculo.tipo_vehiculo,
                "modelo": vehiculo.modelo,
                "capacidad_kg": float(vehiculo.capacidad_kg),
                "carga_actual_kg": carga_actual,
                "capacidad_disponible_kg": max(
                    0, float(vehiculo.capacidad_kg) - carga_actual
                ),
                "estado_vehiculo": vehiculo.estado_vehiculo or "disponible",
            })
        return result

    def obtener_conductores_disponibles(self):
        return [
            {
                "id_conductor": conductor.id_conductor if conductor else None,
                "nombre_conductor": f"{usuario.nombre_usuario} {usuario.apellido}".strip(),
                "foto_perfil": usuario.foto_perfil,
                "licencia": conductor.licencia if conductor else None,
                "tiene_foto_licencia": bool(conductor and conductor.foto_licencia),
            }
            for usuario, conductor in self.repository.get_conductores_disponibles()
        ]

    def obtener_cooperativas_disponibles(self):
        return [{
            "id_cooperativa": cooperativa.id_cooperativa,
            "nombre": cooperativa.nombre,
            "departamento": cooperativa.ubicacion.departamento,
            "ciudad": cooperativa.ubicacion.ciudad,
            "direccion": cooperativa.ubicacion.direccion,
        } for cooperativa in self.repository.get_cooperativas_disponibles() if cooperativa.ubicacion]

    def obtener_historial_asignaciones(self):
        return [
            {
                "id_asignacion": historial.id_asignacion,
                "entrega_id": entrega.id_entrega,
                "caficultor_nombre": f"{caficultor.nombre_usuario} {caficultor.apellido}".strip(),
                "cantidad_kg": float(entrega.cantidad_kg),
                "vehiculo_placa": vehiculo.placa,
                "conductor_nombre": f"{conductor.nombre_usuario} {conductor.apellido}".strip(),
                "coordinador_nombre": f"{coordinador.nombre_usuario} {coordinador.apellido}".strip(),
                "fecha_hora_asignacion": historial.fecha_hora_asignacion,
            }
            for historial, entrega, vehiculo, conductor, coordinador, caficultor
            in self.repository.get_historial_asignaciones()
        ]

    def obtener_entregas_asignadas(self, conductor_id: int):
        return [
            {
                "id_entrega": entrega.id_entrega,
                "solicitud_id": entrega.solicitud_id,
                "caficultor_id": entrega.caficultor_id,
                "caficultor_nombre": f"{caficultor.nombre_usuario} {caficultor.apellido}".strip(),
                "cantidad_kg": float(entrega.cantidad_kg),
                "fecha_hora_entrega": entrega.fecha_hora_entrega,
                "observaciones": entrega.observaciones,
                "estado_entrega": entrega.estado_entrega,
                "vehiculo_placa": vehiculo.placa,
            }
            for entrega, caficultor, vehiculo in self.repository.get_entregas_asignadas_a_conductor(conductor_id)
        ]

    def _obtener_carga_asignada(self, entrega_id: UUID, conductor_id: int):
        entrega = self.repository.get_entrega_asignada_a_conductor(entrega_id, conductor_id)
        if entrega is None:
            raise HTTPException(status_code=403, detail="Solo puedes reportar eventos de tu entrega asignada")
        solicitud = self.repository.get_solicitud(entrega.solicitud_id)
        if solicitud is None or solicitud.carga_id is None:
            raise HTTPException(status_code=400, detail="La entrega no tiene una carga asociada")
        return entrega, solicitud.carga_id

    def reportar_evento_conductor(self, entrega_id: UUID, tipo_evento: str, detalle: str | None, usuario_id: int, conductor_id: int):
        entrega, carga_id = self._obtener_carga_asignada(entrega_id, conductor_id)
        if entrega.estado_entrega != "en camino":
            raise HTTPException(status_code=400, detail="Solo puedes reportar eventos durante un viaje en camino")
        etiquetas = {
            "inicio del viaje": "Inicio del viaje",
            "retraso": "Retraso",
            "llegada": "Llegada al punto de recolección",
            "inconveniente": "Inconveniente",
            "entrega realizada": "Entrega realizada",
            "daño vehicular": "Daño vehicular",
            "parada baño": "Parada para ir al baño",
            "imprevisto nuevo": "Nuevo imprevisto",
        }
        descripcion = etiquetas[tipo_evento]
        if detalle and detalle.strip():
            descripcion = f"{descripcion}: {detalle.strip()}"
        ahora = utc_now_naive()
        return self.repository.crear_evento_conductor(HistorialEvento(
            carga_id=carga_id,
            entrega_id=entrega_id,
            tipo_evento=tipo_evento,
            descripcion_evento=descripcion,
            fecha_hora_evento=ahora,
            fecha_hora_sincronizacion=ahora,
            conductor_id=conductor_id,
            usuario_id_cambio=usuario_id,
            expira_en=ahora + timedelta(days=EVENT_RETENTION_DAYS),
        ))

    def obtener_eventos_conductor(self, entrega_id: UUID, conductor_id: int):
        _, carga_id = self._obtener_carga_asignada(entrega_id, conductor_id)
        return self.repository.get_eventos_conductor(carga_id, conductor_id, utc_now_naive())

    def obtener_notificaciones_eventos(self, usuario, entrega_id=None, estado=None, tipo_evento=None):
        es_caficultor = bool(usuario.rol and usuario.rol.descripcion_rol.lower() == "caficultor")
        return [{
            "id_evento": evento.id_evento,
            "tipo_evento": evento.tipo_evento,
            "descripcion_evento": evento.descripcion_evento,
            "fecha_hora_evento": evento.fecha_hora_evento,
            "expira_en": evento.expira_en,
            "entrega_id": entrega.id_entrega,
            "carga_id": carga.id_carga,
            "carga_peso_kg": float(carga.peso_kg or 0),
            "caficultor_nombre": f"{caficultor.nombre_usuario} {caficultor.apellido}".strip(),
            "estado_recoleccion": entrega.estado_entrega,
            "vehiculo_placa": vehiculo.placa if vehiculo else None,
            "conductor_nombre": f"{conductor.nombre_usuario} {conductor.apellido}".strip(),
            "conductor_foto_perfil": conductor.foto_perfil,
        } for evento, carga, entrega, vehiculo, conductor, caficultor in self.repository.get_notificaciones_eventos(
            utc_now_naive(),
            usuario.id_usuario if es_caficultor else None,
            entrega_id,
            estado,
            tipo_evento,
        )]

    def eliminar_evento(self, evento_id: UUID):
        if not self.repository.eliminar_evento(evento_id):
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        return {"mensaje": "Evento eliminado"}

    def actualizar_estado(self, entrega_id: UUID, estado_nuevo: str, usuario_id: int, conductor_id: int, modificado_en=None):
        entrega = self.repository.get_entrega_asignada_a_conductor(
            entrega_id, conductor_id, for_update=True
        )
        if entrega is None:
            raise HTTPException(status_code=403, detail="Solo puedes actualizar entregas asignadas a tu vehículo")
        if entrega.viaje_id is not None:
            raise HTTPException(status_code=409, detail="El estado de esta carga se administra desde el viaje")
        if entrega.estado_entrega == "cancelado":
            raise HTTPException(status_code=400, detail="Una entrega cancelada no puede cambiar de estado")
        if entrega.estado_entrega == estado_nuevo:
            raise HTTPException(status_code=400, detail="La entrega ya tiene ese estado")
        if estado_nuevo == "entregado" and entrega.carga_recogida_en is None:
            raise HTTPException(status_code=400, detail="Primero debes confirmar la recogida de la carga en la finca")
        if modificado_en and entrega.actualizado_en:
            fecha_cliente = to_utc_naive(modificado_en)
            if fecha_cliente <= entrega.actualizado_en:
                raise HTTPException(status_code=409, detail="Existe una actualización más reciente registrada por el servidor")
        transiciones = {
            "pendiente": {"en camino", "cancelado"},
            "en camino": {"entregado", "cancelado"},
            "entregado": set(),
            "cancelado": set(),
        }
        if estado_nuevo not in transiciones.get(entrega.estado_entrega, set()):
            raise HTTPException(status_code=400, detail="Transición de estado no permitida")

        try:
            entrega_actualizada = self.repository.actualizar_estado(
                entrega, estado_nuevo, usuario_id, commit=False
            )
            solicitud = self.repository.get_solicitud(entrega.solicitud_id)
            if solicitud is not None:
                solicitud.estado_solicitud = estado_nuevo
                if solicitud.carga and solicitud.carga.vehiculo:
                    if estado_nuevo in {"entregado", "cancelado"}:
                        solicitud.carga.vehiculo.estado_vehiculo = "disponible"
                        siguiente = self.repository.siguiente_viaje_en_cola(solicitud.carga.vehiculo.id_vehiculo)
                        if siguiente is not None:
                            siguiente.estado_viaje = "asignado"
                    elif estado_nuevo == "en camino":
                        solicitud.carga.vehiculo.estado_vehiculo = "en camino"
            self.repository.db.commit()
            self.repository.db.refresh(entrega_actualizada)
            return entrega_actualizada
        except Exception:
            self.repository.db.rollback()
            raise

    def obtener_historial_estados(self, entrega_id: UUID, usuario, es_conductor: bool):
        if es_conductor:
            conductor = usuario.conductor
            if conductor is None or self.repository.get_entrega_asignada_a_conductor(entrega_id, conductor.id_conductor) is None:
                raise HTTPException(status_code=403, detail="No tienes acceso a la trazabilidad de esta entrega")
        elif self.repository.get_entrega(entrega_id) is None:
            raise HTTPException(status_code=404, detail="Entrega no encontrada")
        return [
            {
                "id_historial": item.id_historial,
                "estado_anterior": item.estado_anterior,
                "estado_nuevo": item.estado_nuevo,
                "usuario_id": usuario_cambio.id_usuario,
                "usuario_nombre": f"{usuario_cambio.nombre_usuario} {usuario_cambio.apellido}".strip(),
                "fecha_hora_cambio": item.fecha_hora_cambio,
            }
            for item, usuario_cambio in self.repository.get_historial_estados(entrega_id)
        ]

    def obtener_historial_estados_lote(self, entrega_ids: list[UUID], usuario, es_conductor: bool):
        ids = list(dict.fromkeys(entrega_ids))
        if not ids:
            return []
        existentes = self.repository.get_entrega_ids_existentes(ids)
        if existentes != set(ids):
            raise HTTPException(status_code=404, detail="Una o más entregas no existen")
        if es_conductor:
            conductor = usuario.conductor
            autorizadas = set() if conductor is None else self.repository.get_entrega_ids_asignadas_a_conductor(
                ids, conductor.id_conductor
            )
            if autorizadas != set(ids):
                raise HTTPException(status_code=403, detail="No tienes acceso a una o más entregas solicitadas")
        return [
            {
                "entrega_id": item.entrega_id,
                "id_historial": item.id_historial,
                "estado_anterior": item.estado_anterior,
                "estado_nuevo": item.estado_nuevo,
                "usuario_id": usuario_cambio.id_usuario,
                "usuario_nombre": f"{usuario_cambio.nombre_usuario} {usuario_cambio.apellido}".strip(),
                "fecha_hora_cambio": item.fecha_hora_cambio,
            }
            for item, usuario_cambio in self.repository.get_historial_estados_lote(ids)
        ]

    def asignar_vehiculo(self, entrega_id: UUID, vehiculo_id: int, conductor_id: int, cooperativa_id: int, coordinador_id: int):
        entrega = self.repository.db.query(Entrega).filter(
            Entrega.id_entrega == entrega_id
        ).with_for_update().first()
        if entrega is None or entrega.estado_entrega != "pendiente":
            raise HTTPException(status_code=404, detail="Entrega pendiente no encontrada")

        solicitud = self.repository.get_solicitud_activa(entrega.solicitud_id)
        if solicitud is None or solicitud.carga is None:
            raise HTTPException(status_code=400, detail="La entrega no tiene una solicitud activa apta para asignación")

        vehiculo = self.repository.get_vehiculo_disponible(vehiculo_id, for_update=True)
        if vehiculo is None:
            raise HTTPException(status_code=400, detail="El vehículo no está disponible")
        if self.repository.vehiculo_tiene_entrega_activa(vehiculo_id):
            raise HTTPException(status_code=400, detail="El vehículo ya está asociado a una entrega activa")
        conductor = self.repository.get_conductor(conductor_id, for_update=True)
        if conductor is None:
            raise HTTPException(status_code=400, detail="El conductor seleccionado no existe")
        if not conductor.foto_licencia:
            raise HTTPException(status_code=400, detail="El conductor debe tener una foto de licencia registrada")
        usuario_conductor = conductor.usuarios
        if (
            not usuario_conductor.habilitado or not usuario_conductor.rol
            or usuario_conductor.rol.descripcion_rol.lower() != "conductor"
        ):
            raise HTTPException(status_code=400, detail="El conductor debe estar habilitado y tener rol de conductor")
        if self.repository.conductor_tiene_viaje_activo(conductor_id, vehiculo_id):
            raise HTTPException(status_code=400, detail="El conductor ya tiene un vehículo en camino")
        cooperativa = self.repository.db.query(Cooperativa).filter(
            Cooperativa.id_cooperativa == cooperativa_id
        ).first()
        self._coordenadas_cooperativa(cooperativa)
        self._guardar_snapshot_finca(entrega, entrega.caficultor)

        carga_actual = self.repository.get_peso_cargado_vehiculo(vehiculo_id)
        peso_nuevo = float(entrega.cantidad_kg)
        if carga_actual + peso_nuevo > float(vehiculo.capacidad_kg):
            raise HTTPException(
                status_code=400,
                detail=(f"La carga total sería {carga_actual + peso_nuevo:.2f} kg y supera "
                        f"el máximo de {float(vehiculo.capacidad_kg):.2f} kg del vehículo"),
            )

        return self.repository.asignar_vehiculo(
            entrega, vehiculo, conductor, cooperativa, solicitud, solicitud.carga, coordinador_id
        )

    def confirmar_carga_recogida(self, entrega_id: UUID, usuario_id: int, conductor_id: int):
        entrega = self.repository.get_entrega_asignada_a_conductor(
            entrega_id, conductor_id, for_update=True
        )
        if entrega is None:
            raise HTTPException(status_code=403, detail="Solo puedes confirmar la carga asignada a tu vehículo")
        if entrega.estado_entrega != "en camino":
            raise HTTPException(status_code=400, detail="Inicia el viaje antes de confirmar la carga")
        if entrega.carga_recogida_en is not None:
            return {
                "entrega_id": entrega.id_entrega,
                "carga_recogida_en": entrega.carga_recogida_en,
                "etapa_viaje": "hacia_cooperativa",
            }
        solicitud = self.repository.get_solicitud(entrega.solicitud_id)
        carga = solicitud.carga if solicitud else None
        if carga is None or carga.cooperativa is None or carga.cooperativa.ubicacion is None:
            raise HTTPException(status_code=400, detail="La entrega no tiene una cooperativa de destino asignada")
        self._guardar_snapshot_finca(entrega, entrega.caficultor, requerido=False)
        if entrega.finca_latitud_snapshot is None or entrega.finca_longitud_snapshot is None:
            raise HTTPException(status_code=400, detail="La entrega no tiene una ubicación de recolección congelada")
        ultimo = (
            self.repository.get_ultimo_punto_ruta_viaje(entrega.viaje_id)
            if entrega.viaje_id else self.repository.get_ultimo_punto_ruta(entrega_id)
        )
        if ultimo is None:
            raise HTTPException(status_code=400, detail="Activa el GPS para confirmar que llegaste al punto de recolección")
        antiguedad = (utc_now_naive() - to_utc_naive(ultimo.registrada_en)).total_seconds()
        if antiguedad < -TOLERANCIA_FUTURO_GEOCERCA_SEGUNDOS:
            raise HTTPException(status_code=400, detail="La ubicación GPS tiene una hora futura no válida para confirmar la carga")
        if antiguedad > MAX_ANTIGUEDAD_CONFIRMACION_SEGUNDOS:
            raise HTTPException(status_code=400, detail="Actualiza tu ubicación GPS antes de confirmar la carga")
        if ultimo.precision_m is None or float(ultimo.precision_m) > MAX_PRECISION_METROS:
            raise HTTPException(status_code=400, detail="La ubicación GPS no tiene precisión suficiente para confirmar la carga")
        distancia = _distancia_metros(
            float(ultimo.latitud), float(ultimo.longitud),
            float(entrega.finca_latitud_snapshot), float(entrega.finca_longitud_snapshot),
        )
        if distancia > RADIO_CONFIRMACION_CARGA_METROS:
            raise HTTPException(
                status_code=400,
                detail=f"Debes estar a menos de {RADIO_CONFIRMACION_CARGA_METROS} m del caficultor. Distancia actual: {distancia:.0f} m",
            )
        ahora = utc_now_naive()
        entrega.carga_recogida_en = ahora
        self.repository.db.add(HistorialEvento(
            carga_id=carga.id_carga,
            entrega_id=entrega.id_entrega,
            tipo_evento="carga recogida",
            descripcion_evento="Carga recogida y confirmada por el conductor",
            fecha_hora_evento=ahora,
            fecha_hora_sincronizacion=ahora,
            conductor_id=conductor_id,
            usuario_id_cambio=usuario_id,
            expira_en=ahora + timedelta(days=EVENT_RETENTION_DAYS),
        ))
        self.repository.db.commit()
        self.repository.db.refresh(entrega)
        return {
            "entrega_id": entrega.id_entrega,
            "carga_recogida_en": entrega.carga_recogida_en,
            "etapa_viaje": "hacia_cooperativa",
        }
