from datetime import datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entrega_models import Entrega
from app.models.historial_eventos_models import HistorialEvento
from app.models.seguimiento_ubicacion_models import SeguimientoUbicacion
from app.core.time import as_utc_aware, to_utc_naive, utc_now_naive
from app.core.observability import logger, process_metrics
from app.repositories.entrega_repositories import EntregaRepository
from app.schemas.entrega_schemas import EntregaCreate, RegistrarUbicacionRequest, SincronizarUbicacionesRequest


MAX_PRECISION_METROS = 150
MAX_VELOCIDAD_METROS_SEGUNDO = 60
DISTANCIA_DUPLICADO_METROS = 5
VENTANA_DUPLICADO_SEGUNDOS = 20


def _fecha_utc_sin_zona(fecha: datetime) -> datetime:
    return to_utc_naive(fecha)


def _distancia_metros(latitud_a: float, longitud_a: float, latitud_b: float, longitud_b: float) -> float:
    radio_tierra = 6_371_000
    delta_latitud = radians(latitud_b - latitud_a)
    delta_longitud = radians(longitud_b - longitud_a)
    valor = sin(delta_latitud / 2) ** 2 + cos(radians(latitud_a)) * cos(radians(latitud_b)) * sin(delta_longitud / 2) ** 2
    return 2 * radio_tierra * asin(sqrt(min(1.0, max(0.0, valor))))


class EntregaService:
    def __init__(self, db: Session):
        self.repository = EntregaRepository(db)

    def obtener_entregas(self, skip: int = 0, limit: int = 100):
        return self.repository.get_entregas(skip, limit)

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
        # Serializa los escritores de una entrega. Esto evita perder incrementos
        # de distancia o aceptar dos veces el mismo reintento concurrente.
        registro = self.repository.get_vehiculo_entrega(entrega_id, for_update=True)
        if not registro:
            raise HTTPException(status_code=404, detail="Entrega con vehículo asignado no encontrada")
        entrega, vehiculo = registro
        if vehiculo.conductor_id != conductor_id:
            raise HTTPException(status_code=403, detail="Solo el conductor asignado puede enviar la ubicación")
        if entrega.estado_entrega != "en camino":
            raise HTTPException(status_code=400, detail="El GPS solo puede actualizarse cuando la entrega está en camino")
        return entrega, vehiculo

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

    def _registrar_punto_validado(self, entrega, vehiculo, punto: RegistrarUbicacionRequest, commit: bool = True):
        entrega_id = entrega.id_entrega
        existente = self.repository.get_ubicacion_por_client_point_id(punto.client_point_id)
        if existente:
            if existente.entrega_id != entrega_id:
                raise HTTPException(status_code=409, detail="El identificador del punto ya pertenece a otra entrega")
            return {
                "estado": "duplicado", "id_ubicacion": existente.id_ubicacion,
                "client_point_id": existente.client_point_id,
                "registrada_en": as_utc_aware(existente.registrada_en),
                "distancia_recorrida_m": float(getattr(entrega, "distancia_recorrida_m", 0) or 0),
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

        anterior, siguiente = self.repository.get_puntos_vecinos(entrega_id, capturada_en)
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
                    "distancia_recorrida_m": float(getattr(entrega, "distancia_recorrida_m", 0) or 0),
                }
            if segundos == 0:
                self._rechazar_punto(
                    entrega_id,
                    punto,
                    "Punto descartado: dos posiciones incompatibles tienen la misma hora de captura",
                )
            if segundos > 0 and distancia / segundos > MAX_VELOCIDAD_METROS_SEGUNDO:
                self._rechazar_punto(
                    entrega_id, punto, "Punto descartado: salto de ubicación físicamente improbable"
                )

        delta_distancia = 0.0
        if anterior is not None:
            delta_distancia += _distancia_metros(
                float(anterior.latitud), float(anterior.longitud), punto.latitud, punto.longitud
            )
        if siguiente is not None:
            delta_distancia += _distancia_metros(
                punto.latitud, punto.longitud, float(siguiente.latitud), float(siguiente.longitud)
            )
        if anterior is not None and siguiente is not None:
            delta_distancia -= _distancia_metros(
                float(anterior.latitud), float(anterior.longitud),
                float(siguiente.latitud), float(siguiente.longitud),
            )
        entrega.distancia_recorrida_m = max(
            0.0,
            float(getattr(entrega, "distancia_recorrida_m", 0) or 0) + delta_distancia,
        )

        ubicacion = self.repository.registrar_ubicacion(SeguimientoUbicacion(
            client_point_id=punto.client_point_id,
            entrega_id=entrega.id_entrega, vehiculo_id=vehiculo.id_vehiculo,
            latitud=punto.latitud, longitud=punto.longitud,
            precision_m=punto.precision_m, velocidad_m_s=punto.velocidad_m_s,
            rumbo_grados=punto.rumbo_grados, registrada_en=capturada_en, recibida_en=ahora,
        ), commit=commit)
        return {
            "estado": "guardado", "id_ubicacion": ubicacion.id_ubicacion,
            "client_point_id": ubicacion.client_point_id,
            "registrada_en": as_utc_aware(ubicacion.registrada_en),
            "distancia_recorrida_m": entrega.distancia_recorrida_m,
        }

    def registrar_ubicacion(self, entrega_id: UUID, punto: RegistrarUbicacionRequest, conductor_id: int):
        entrega, vehiculo = self._contexto_gps(entrega_id, conductor_id)
        result = self._registrar_punto_validado(entrega, vehiculo, punto)
        process_metrics.increment(
            "gps_points_saved" if result["estado"] == "guardado" else "gps_points_duplicate"
        )
        return result

    def sincronizar_ubicaciones(self, entrega_id: UUID, lote: SincronizarUbicacionesRequest, conductor_id: int):
        entrega, vehiculo = self._contexto_gps(entrega_id, conductor_id)
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
                    resultado = self._registrar_punto_validado(entrega, vehiculo, punto, commit=False)
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
            "distancia_recorrida_m": float(getattr(entrega, "distancia_recorrida_m", 0) or 0),
        }

    def obtener_seguimiento(self, entrega_id: UUID, usuario):
        registro = self.repository.get_vehiculo_entrega(entrega_id)
        if not registro:
            raise HTTPException(status_code=404, detail="Entrega con vehículo asignado no encontrada")
        entrega, vehiculo = registro
        role = usuario.rol.descripcion_rol.lower() if usuario.rol else ""
        if role == "caficultor" and entrega.caficultor_id != usuario.id_usuario:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta entrega")
        if role == "conductor" and (not usuario.conductor or vehiculo.conductor_id != usuario.conductor.id_conductor):
            raise HTTPException(status_code=403, detail="No tienes acceso a esta entrega")
        puntos, total_puntos = self.repository.get_puntos_ruta(entrega_id)
        return {
            "entrega_id": entrega.id_entrega, "estado_entrega": entrega.estado_entrega,
            "vehiculo_id": vehiculo.id_vehiculo, "vehiculo_placa": vehiculo.placa,
            "destino": ", ".join(filter(None, [
                f"{entrega.caficultor.nombre_usuario} {entrega.caficultor.apellido}".strip() if entrega.caficultor else None,
                entrega.caficultor.vereda if entrega.caficultor else None,
                entrega.caficultor.municipio if entrega.caficultor else None,
                entrega.caficultor.departamento if entrega.caficultor else None,
            ])),
            "destino_latitud": float(entrega.caficultor.latitud_finca) if entrega.caficultor and entrega.caficultor.latitud_finca is not None else None,
            "destino_longitud": float(entrega.caficultor.longitud_finca) if entrega.caficultor and entrega.caficultor.longitud_finca is not None else None,
            "destino_actualizado_en": entrega.caficultor.ubicacion_finca_actualizada_en if entrega.caficultor else None,
            "total_puntos": total_puntos,
            "ruta_truncada": total_puntos > len(puntos),
            "distancia_recorrida_m": float(entrega.distancia_recorrida_m or 0),
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
            }
            for solicitud, usuario, carga in registros
        ]

    def crear_entrega(self, datos: EntregaCreate):
        solicitud = self.repository.get_solicitud_activa(datos.solicitud_id)
        if solicitud is None or solicitud.carga is None:
            raise HTTPException(
                status_code=400,
                detail="La entrega requiere una solicitud activa previamente registrada",
            )
        cantidad_kg = float(solicitud.carga.peso_kg or 0)
        if cantidad_kg <= 0:
            raise HTTPException(status_code=400, detail="La solicitud no tiene un peso de carga válido")

        return self.repository.create_entrega(Entrega(
            solicitud_id=solicitud.id_solicitud,
            caficultor_id=solicitud.caficultor_id,
            # El peso siempre procede de la carga creada en la solicitud.
            cantidad_kg=cantidad_kg,
            fecha_hora_entrega=datos.fecha_hora_entrega,
            observaciones=datos.observaciones,
            estado_entrega="pendiente", actualizado_en=utc_now_naive(),
        ))

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
            })
        return result

    def obtener_conductores_disponibles(self):
        return [
            {
                "id_conductor": conductor.id_conductor if conductor else None,
                "nombre_conductor": f"{usuario.nombre_usuario} {usuario.apellido}".strip(),
                "licencia": conductor.licencia if conductor else None,
                "tiene_foto_licencia": bool(conductor and conductor.foto_licencia),
            }
            for usuario, conductor in self.repository.get_conductores_disponibles()
        ]

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
            descripcion_evento=descripcion,
            fecha_hora_evento=ahora,
            fecha_hora_sincronizacion=ahora,
            conductor_id=conductor_id,
            usuario_id_cambio=usuario_id,
        ))

    def obtener_eventos_conductor(self, entrega_id: UUID, conductor_id: int):
        _, carga_id = self._obtener_carga_asignada(entrega_id, conductor_id)
        return self.repository.get_eventos_conductor(carga_id, conductor_id)

    def actualizar_estado(self, entrega_id: UUID, estado_nuevo: str, usuario_id: int, conductor_id: int, modificado_en=None):
        entrega = self.repository.get_entrega_asignada_a_conductor(
            entrega_id, conductor_id, for_update=True
        )
        if entrega is None:
            raise HTTPException(status_code=403, detail="Solo puedes actualizar entregas asignadas a tu vehículo")
        if entrega.estado_entrega == "cancelado":
            raise HTTPException(status_code=400, detail="Una entrega cancelada no puede cambiar de estado")
        if entrega.estado_entrega == estado_nuevo:
            raise HTTPException(status_code=400, detail="La entrega ya tiene ese estado")
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

    def asignar_vehiculo(self, entrega_id: UUID, vehiculo_id: int, conductor_id: int, coordinador_id: int):
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
        if self.repository.conductor_tiene_viaje_activo(conductor_id, vehiculo_id):
            raise HTTPException(status_code=400, detail="El conductor ya tiene un vehículo en camino")

        carga_actual = self.repository.get_peso_cargado_vehiculo(vehiculo_id)
        peso_nuevo = float(entrega.cantidad_kg)
        if carga_actual + peso_nuevo > float(vehiculo.capacidad_kg):
            raise HTTPException(
                status_code=400,
                detail=(f"La carga total sería {carga_actual + peso_nuevo:.2f} kg y supera "
                        f"el máximo de {float(vehiculo.capacidad_kg):.2f} kg del vehículo"),
            )

        return self.repository.asignar_vehiculo(
            entrega, vehiculo, conductor, solicitud, solicitud.carga, coordinador_id
        )
