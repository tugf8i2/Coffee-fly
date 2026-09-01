from uuid import UUID
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
from app.models.usuario_models import Usuario
from app.core.time import utc_now_naive


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

    @staticmethod
    def _rol(usuario: Usuario) -> str:
        return usuario.rol.descripcion_rol.lower() if usuario.rol else ""

    def _autorizar(self, carga, usuario: Usuario):
        if self._rol(usuario) in {"coordinador", "registrador"}:
            return carga
        if self._rol(usuario) == "caficultor" and carga.caficultor_id == usuario.id_usuario:
            return carga
        raise HTTPException(status_code=403, detail="No tienes acceso a esta carga")

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
        usuario: Usuario,
        skip: int = 0,
        limit: int = 100
    ):
        owner_id = usuario.id_usuario if self._rol(usuario) == "caficultor" else None
        return self.repository.get_cargas(skip, limit, owner_id)


    def obtener_carga(
        self,
        id_carga: UUID,
        usuario: Usuario,
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

        return self._autorizar(carga, usuario)


    def crear_carga(
        self,
        carga: CargaCreate,
        caficultor_id: int,
    ):

        datos = carga.model_dump()
        # El caficultor registra el contenido; la asignación logística se hace
        # después desde el módulo protegido del coordinador.
        datos.update({"vehiculo_id": None, "cooperativa_id": None, "ruta_id": None})
        if datos["peso_kg"] <= 0:
            raise HTTPException(status_code=400, detail="El peso de la carga debe ser mayor que cero")
        self._validar_capacidad_vehiculo(datos.get("vehiculo_id"), datos["peso_kg"])
        return (
            self.repository
            .create_carga(
                CargaCreate(**datos),
                caficultor_id,
            )
        )


    def actualizar_carga(
        self,
        id_carga: UUID,
        carga: CargaUpdate,
        usuario: Usuario,
    ):

        carga_existente = self.repository.get_carga(id_carga)
        if carga_existente is None:
            raise HTTPException(status_code=404, detail="Carga no encontrada")
        self._autorizar(carga_existente, usuario)

        datos = (
            carga
            .model_dump(
                exclude_unset=True
            )
        )
        if self._rol(usuario) == "caficultor":
            for field in ("vehiculo_id", "cooperativa_id", "ruta_id", "estado_sincronizacion"):
                datos.pop(field, None)

        peso_final = datos.get("peso_kg", float(carga_existente.peso_kg))
        vehiculo_final = datos.get("vehiculo_id", carga_existente.vehiculo_id)
        if peso_final is None or peso_final <= 0:
            raise HTTPException(status_code=400, detail="El peso de la carga debe ser mayor que cero")
        self._validar_capacidad_vehiculo(vehiculo_final, peso_final, id_carga)


        datos[
            "actualizado_en"
        ] = (
            utc_now_naive()
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
        id_carga: UUID,
        usuario: Usuario,
    ):
        existente = self.repository.get_carga(id_carga)
        if existente is None:
            raise HTTPException(status_code=404, detail="Carga no encontrada")
        self._autorizar(existente, usuario)
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
