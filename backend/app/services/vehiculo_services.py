from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.vehiculo_repositories import (
    VehiculoRepository
)

from app.schemas.vehiculo_schemas import (
    VehiculoCreate,
    VehiculoUpdate
)
from app.models.conductor_models import Conductor


class VehiculoService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            VehiculoRepository(
                db
            )
        )


    def obtener_vehiculos(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_vehiculos(
                skip,
                limit
            )
        )


    def obtener_vehiculo(
        self,
        id_vehiculo: int
    ):

        vehiculo = (
            self.repository
            .get_vehiculo(
                id_vehiculo
            )
        )

        if vehiculo is None:

            raise HTTPException(
                status_code=404,
                detail="Vehículo no encontrado"
            )

        return vehiculo


    def crear_vehiculo(
        self,
        vehiculo: VehiculoCreate
    ):

        datos = vehiculo.model_dump()
        datos["placa"] = datos["placa"].strip().upper()
        datos["tipo_vehiculo"] = datos["tipo_vehiculo"].strip()
        datos["modelo"] = (datos.get("modelo") or "").strip() or None
        datos["estado_vehiculo"] = datos.get("estado_vehiculo") or "disponible"

        if self.repository.get_vehiculo_by_placa(datos["placa"]):
            raise HTTPException(status_code=400, detail="La placa ya está registrada")
        if datos["capacidad_kg"] <= 0:
            raise HTTPException(status_code=400, detail="La capacidad debe ser mayor que cero")
        if not datos["modelo"]:
            raise HTTPException(status_code=400, detail="El modelo del vehículo es obligatorio")
        if datos.get("conductor_id") is None:
            raise HTTPException(status_code=400, detail="Debes asignar un conductor al vehículo")
        if not self.repository.db.query(Conductor).filter(Conductor.id_conductor == datos["conductor_id"]).first():
            raise HTTPException(status_code=400, detail="El conductor asignado no existe")
        if datos["estado_vehiculo"] == "en camino":
            raise HTTPException(status_code=400, detail="Un vehículo solo pasa a 'en camino' al asignarse a una entrega")

        return (
            self.repository
            .create_vehiculo(VehiculoCreate(**datos))
        )


    def actualizar_vehiculo(
        self,
        id_vehiculo: int,
        vehiculo: VehiculoUpdate
    ):

        datos = vehiculo.model_dump(exclude_unset=True)
        if "placa" in datos:
            datos["placa"] = datos["placa"].strip().upper()
            existente = self.repository.get_vehiculo_by_placa(datos["placa"])
            if existente and existente.id_vehiculo != id_vehiculo:
                raise HTTPException(status_code=400, detail="La placa ya está registrada")
        if "capacidad_kg" in datos and datos["capacidad_kg"] <= 0:
            raise HTTPException(status_code=400, detail="La capacidad debe ser mayor que cero")
        if "conductor_id" in datos and datos["conductor_id"] is not None and not self.repository.db.query(Conductor).filter(Conductor.id_conductor == datos["conductor_id"]).first():
            raise HTTPException(status_code=400, detail="El conductor asignado no existe")
        if datos.get("estado_vehiculo") == "en camino":
            raise HTTPException(status_code=400, detail="El estado 'en camino' solo se actualiza desde una entrega asignada")

        actualizado = (
            self.repository
            .update_vehiculo(
                id_vehiculo,
                VehiculoUpdate(**datos)
            )
        )

        if actualizado is None:

            raise HTTPException(
                status_code=404,
                detail="Vehículo no encontrado"
            )

        return actualizado


    def eliminar_vehiculo(
        self,
        id_vehiculo: int
    ):

        eliminado = (
            self.repository
            .delete_vehiculo(
                id_vehiculo
            )
        )

        if eliminado is None:

            raise HTTPException(
                status_code=404,
                detail="Vehículo no encontrado"
            )

        return {
            "mensaje":
            "Vehículo eliminado"
        }
