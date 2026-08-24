from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entrega_models import Entrega
from app.repositories.entrega_repositories import EntregaRepository
from app.schemas.entrega_schemas import EntregaCreate


class EntregaService:
    def __init__(self, db: Session):
        self.repository = EntregaRepository(db)

    def obtener_entregas(self, skip: int = 0, limit: int = 100):
        return self.repository.get_entregas(skip, limit)

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
            estado_entrega="pendiente",
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
        return [
            {
                "id_vehiculo": vehiculo.id_vehiculo,
                "placa": vehiculo.placa,
                "tipo_vehiculo": vehiculo.tipo_vehiculo,
                "modelo": vehiculo.modelo,
                "capacidad_kg": float(vehiculo.capacidad_kg),
                "carga_actual_kg": self.repository.get_peso_cargado_vehiculo(vehiculo.id_vehiculo),
                "capacidad_disponible_kg": max(
                    0, float(vehiculo.capacidad_kg) - self.repository.get_peso_cargado_vehiculo(vehiculo.id_vehiculo)
                ),
            }
            for vehiculo in self.repository.get_vehiculos_disponibles()
        ]

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

    def actualizar_estado(self, entrega_id: UUID, estado_nuevo: str, usuario_id: int, conductor_id: int):
        entrega = self.repository.get_entrega_asignada_a_conductor(entrega_id, conductor_id)
        if entrega is None:
            raise HTTPException(status_code=403, detail="Solo puedes actualizar entregas asignadas a tu vehículo")
        if entrega.estado_entrega == "cancelado":
            raise HTTPException(status_code=400, detail="Una entrega cancelada no puede cambiar de estado")
        if entrega.estado_entrega == estado_nuevo:
            raise HTTPException(status_code=400, detail="La entrega ya tiene ese estado")

        entrega_actualizada = self.repository.actualizar_estado(entrega, estado_nuevo, usuario_id)
        solicitud = self.repository.get_solicitud(entrega.solicitud_id)
        if solicitud is not None:
            solicitud.estado_solicitud = estado_nuevo
            if solicitud.carga and solicitud.carga.vehiculo:
                if estado_nuevo in {"entregado", "cancelado"}:
                    solicitud.carga.vehiculo.estado_vehiculo = "disponible"
                    solicitud.carga.vehiculo_id = None
                elif estado_nuevo == "en camino":
                    solicitud.carga.vehiculo.estado_vehiculo = "en camino"
            self.repository.db.commit()
            self.repository.db.refresh(entrega_actualizada)
        return entrega_actualizada

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

    def asignar_vehiculo(self, entrega_id: UUID, vehiculo_id: int, conductor_id: int, coordinador_id: int):
        entrega = self.repository.get_entrega(entrega_id)
        if entrega is None or entrega.estado_entrega != "pendiente":
            raise HTTPException(status_code=404, detail="Entrega pendiente no encontrada")

        solicitud = self.repository.get_solicitud_activa(entrega.solicitud_id)
        if solicitud is None or solicitud.carga is None:
            raise HTTPException(status_code=400, detail="La entrega no tiene una solicitud activa apta para asignación")

        vehiculo = next((item for item in self.repository.get_vehiculos_disponibles() if item.id_vehiculo == vehiculo_id), None)
        if vehiculo is None:
            raise HTTPException(status_code=400, detail="El vehículo no está disponible")
        conductor = self.repository.get_conductor(conductor_id)
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
