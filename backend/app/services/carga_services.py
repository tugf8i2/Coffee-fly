from uuid import UUID
from datetime import datetime

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.carga_repositories import (
    CargaRepository
)

from app.schemas.carga_schemas import (
    CargaCreate,
    CargaUpdate
)
from app.models.vehiculo_models import Vehiculo


class CargaService:

    def __init__(
        self,
        db: Session
    ):
        self.repository = (
            CargaRepository(
                db
            )
        )

    def _validar_capacidad_vehiculo(self, vehiculo_id: int | None, peso_kg: float, carga_id: UUID | None = None):
        if vehiculo_id is None:
            return
        vehiculo = self.repository.db.query(Vehiculo).filter(Vehiculo.id_vehiculo == vehiculo_id).first()
        if vehiculo is None:
            raise HTTPException(status_code=400, detail="El vehículo indicado no existe")
        peso_actual = self.repository.get_peso_asignado_vehiculo(vehiculo_id, carga_id)
        if peso_actual + float(peso_kg) > float(vehiculo.capacidad_kg):
            raise HTTPException(
                status_code=400,
                detail=(f"La carga total sería {peso_actual + float(peso_kg):.2f} kg y supera "
                        f"el máximo de {float(vehiculo.capacidad_kg):.2f} kg del vehículo"),
            )


    def obtener_cargas(
        self,
        skip: int = 0,
        limit: int = 100
    ):

        return (
            self.repository
            .get_cargas(
                skip,
                limit
            )
        )


    def obtener_carga(
        self,
        id_carga: UUID
    ):

        carga = (
            self.repository
            .get_carga(
                id_carga
            )
        )

        if carga is None:

            raise HTTPException(
                status_code=404,
                detail="Carga no encontrada"
            )

        return carga


    def crear_carga(
        self,
        carga: CargaCreate
    ):

        datos = carga.model_dump()
        if datos["peso_kg"] <= 0:
            raise HTTPException(status_code=400, detail="El peso de la carga debe ser mayor que cero")
        self._validar_capacidad_vehiculo(datos.get("vehiculo_id"), datos["peso_kg"])
        return (
            self.repository
            .create_carga(
                CargaCreate(**datos)
            )
        )


    def actualizar_carga(
        self,
        id_carga: UUID,
        carga: CargaUpdate
    ):

        carga_existente = self.repository.get_carga(id_carga)
        if carga_existente is None:
            raise HTTPException(status_code=404, detail="Carga no encontrada")

        datos = (
            carga
            .model_dump(
                exclude_unset=True
            )
        )

        peso_final = datos.get("peso_kg", float(carga_existente.peso_kg))
        vehiculo_final = datos.get("vehiculo_id", carga_existente.vehiculo_id)
        if peso_final is None or peso_final <= 0:
            raise HTTPException(status_code=400, detail="El peso de la carga debe ser mayor que cero")
        self._validar_capacidad_vehiculo(vehiculo_final, peso_final, id_carga)


        datos[
            "actualizado_en"
        ] = (
            datetime.now()
        )


        carga_actualizada = (
            CargaUpdate(
                **datos
            )
        )


        resultado = (
            self.repository
            .update_carga(
                id_carga,
                carga_actualizada
            )
        )

        if resultado is None:

            raise HTTPException(
                status_code=404,
                detail="Carga no encontrada"
            )

        return resultado


    def eliminar_carga(
        self,
        id_carga: UUID
    ):

        eliminada = (
            self.repository
            .delete_carga(
                id_carga
            )
        )

        if eliminada is None:

            raise HTTPException(
                status_code=404,
                detail="Carga no encontrada"
            )

        return {
            "mensaje":
            "Carga eliminada"
        }
