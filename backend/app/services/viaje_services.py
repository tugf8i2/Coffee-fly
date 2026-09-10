from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.models.historial_estado_entrega_models import HistorialEstadoEntrega
from app.models.viaje_models import Viaje
from app.repositories.viaje_repositories import ViajeRepository


class ViajeService:
    def __init__(self, db: Session):
        self.repository = ViajeRepository(db)

    def _respuesta(self, viaje):
        cargas = self.repository.get_cargas_viaje(viaje.id_viaje)
        vehiculo = self.repository.get_vehiculo(viaje.vehiculo_id)
        conductor = self.repository.get_conductor(viaje.conductor_id)
        cooperativa = self.repository.get_cooperativa(viaje.cooperativa_id)
        usuario = conductor.usuarios
        return {
            "id_viaje": viaje.id_viaje, "estado_viaje": viaje.estado_viaje,
            "orden_cola": viaje.orden_cola, "vehiculo_id": viaje.vehiculo_id,
            "vehiculo_placa": vehiculo.placa, "conductor_id": viaje.conductor_id,
            "conductor_nombre": f"{usuario.nombre_usuario} {usuario.apellido}".strip(),
            "cooperativa_nombre": cooperativa.nombre,
            "peso_total_kg": sum(float(entrega.cantidad_kg) for entrega, _ in cargas),
            "puede_iniciar": viaje.estado_viaje == "asignado",
            "creado_en": viaje.creado_en, "iniciado_en": viaje.iniciado_en,
            "completado_en": viaje.completado_en,
            "cargas": [{
                "id_entrega": entrega.id_entrega,
                "caficultor_nombre": f"{caficultor.nombre_usuario} {caficultor.apellido}".strip(),
                "cantidad_kg": float(entrega.cantidad_kg), "estado_entrega": entrega.estado_entrega,
                "carga_recogida_en": entrega.carga_recogida_en,
                "orden_recoleccion": entrega.orden_recoleccion,
            } for entrega, caficultor in cargas],
        }

    def asignar(self, datos, coordinador_id: int):
        ids = list(dict.fromkeys(datos.entrega_ids))
        if len(ids) != len(datos.entrega_ids):
            raise HTTPException(status_code=400, detail="No repitas cargas en una misma asignación")
        db = self.repository.db
        try:
            vehiculo = self.repository.get_vehiculo(datos.vehiculo_id, for_update=True)
            if vehiculo is None or vehiculo.estado_vehiculo == "en mantenimiento":
                raise HTTPException(status_code=400, detail="El vehículo no está disponible para programación")
            entregas = self.repository.get_entregas_for_update(ids)
            if len(entregas) != len(ids) or any(item.estado_entrega != "pendiente" or item.viaje_id for item in entregas):
                raise HTTPException(status_code=409, detail="Una o más cargas ya fueron asignadas")
            entregas_por_id = {item.id_entrega: item for item in entregas}
            entregas = [entregas_por_id[entrega_id] for entrega_id in ids]
            if sum(float(item.cantidad_kg) for item in entregas) > float(vehiculo.capacidad_kg):
                raise HTTPException(status_code=400, detail="Las cargas superan la capacidad del vehículo")
            conductor = self.repository.get_conductor(datos.conductor_id)
            if conductor is None or not conductor.foto_licencia:
                raise HTTPException(status_code=400, detail="El conductor no tiene perfil y licencia completos")
            if self.repository.get_cooperativa(datos.cooperativa_id) is None:
                raise HTTPException(status_code=404, detail="Cooperativa no encontrada")
            ahora = utc_now_naive()
            viaje = Viaje(
                vehiculo_id=vehiculo.id_vehiculo, conductor_id=conductor.id_conductor,
                coordinador_id=coordinador_id, cooperativa_id=datos.cooperativa_id,
                estado_viaje="en_cola" if vehiculo.estado_vehiculo == "en camino" or self.repository.tiene_viajes_pendientes(vehiculo.id_vehiculo) else "asignado",
                orden_cola=self.repository.get_orden_siguiente(vehiculo.id_vehiculo), creado_en=ahora,
            )
            db.add(viaje); db.flush()
            for orden, entrega in enumerate(entregas, 1):
                entrega.viaje_id = viaje.id_viaje; entrega.orden_recoleccion = orden
                entrega.solicitud.carga.vehiculo_id = vehiculo.id_vehiculo
                entrega.solicitud.carga.cooperativa_id = datos.cooperativa_id
                self.repository.agregar_historial(entrega, viaje, coordinador_id)
            db.commit()
            return self._respuesta(viaje)
        except Exception:
            db.rollback()
            raise

    def listar_conductor(self, conductor_id: int, activos=False):
        estados = ["en_camino"] if activos else ["asignado", "en_cola"]
        return [self._respuesta(viaje) for viaje in self.repository.get_viajes_conductor(conductor_id, estados)]

    def iniciar(self, viaje_id: UUID, conductor_id: int, usuario_id: int):
        viaje = self.repository.get_viaje_for_update(viaje_id)
        if viaje is None or viaje.conductor_id != conductor_id:
            raise HTTPException(status_code=403, detail="Este viaje no está asignado al conductor")
        if viaje.estado_viaje != "asignado":
            raise HTTPException(status_code=409, detail="El viaje está en espera o ya fue iniciado")
        if self.repository.viaje_activo_vehiculo_o_conductor(viaje.vehiculo_id, conductor_id):
            raise HTTPException(status_code=409, detail="El vehículo o conductor todavía tiene un viaje activo")
        ahora = utc_now_naive(); viaje.estado_viaje = "en_camino"; viaje.iniciado_en = ahora
        vehiculo = self.repository.get_vehiculo(viaje.vehiculo_id, for_update=True)
        if vehiculo.estado_vehiculo == "en mantenimiento":
            raise HTTPException(status_code=409, detail="El vehículo está en mantenimiento")
        vehiculo.estado_vehiculo = "en camino"; vehiculo.conductor_id = conductor_id
        for entrega, _ in self.repository.get_cargas_viaje(viaje.id_viaje):
            self.repository.db.add(HistorialEstadoEntrega(entrega_id=entrega.id_entrega, estado_anterior=entrega.estado_entrega, estado_nuevo="en camino", usuario_id=usuario_id, fecha_hora_cambio=ahora))
            entrega.estado_entrega = "en camino"; entrega.actualizado_en = ahora
            entrega.solicitud.estado_solicitud = "en camino"
        self.repository.db.commit()
        return self._respuesta(viaje)

    def completar(self, viaje_id: UUID, conductor_id: int, usuario_id: int):
        viaje = self.repository.get_viaje_for_update(viaje_id)
        if viaje is None or viaje.conductor_id != conductor_id or viaje.estado_viaje != "en_camino":
            raise HTTPException(status_code=403, detail="No tienes este viaje activo")
        cargas = self.repository.get_cargas_viaje(viaje.id_viaje)
        if any(not entrega.carga_recogida_en for entrega, _ in cargas):
            raise HTTPException(status_code=409, detail="Confirma la recolección de todas las cargas antes de completar el viaje")
        ahora = utc_now_naive()
        for entrega, _ in cargas:
            self.repository.db.add(HistorialEstadoEntrega(entrega_id=entrega.id_entrega, estado_anterior=entrega.estado_entrega, estado_nuevo="entregado", usuario_id=usuario_id, fecha_hora_cambio=ahora))
            entrega.estado_entrega = "entregado"; entrega.actualizado_en = ahora
            entrega.solicitud.estado_solicitud = "entregado"
        viaje.estado_viaje = "completado"; viaje.completado_en = ahora
        vehiculo = self.repository.get_vehiculo(viaje.vehiculo_id, for_update=True)
        vehiculo.estado_vehiculo = "disponible"; vehiculo.conductor_id = None
        siguiente = self.repository.siguiente_en_cola(viaje.vehiculo_id)
        if siguiente: siguiente.estado_viaje = "asignado"
        self.repository.db.commit()
        return self._respuesta(viaje)
