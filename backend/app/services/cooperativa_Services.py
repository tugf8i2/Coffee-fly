from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.cooperativa_models import Cooperativa
from app.models.ubicacion_models import Ubicacion
from app.repositories.cooperativa_repositories import CooperativaRepository
from app.schemas.cooperativa_schemas import CooperativaCreate, CooperativaUpdate


class CooperativaService:
    def __init__(self, db: Session):
        self.repository = CooperativaRepository(db)

    def obtener_cooperativas(self, skip: int = 0, limit: int = 100):
        return self.repository.get_cooperativas(skip, limit)

    def obtener_cooperativa(self, cooperativa_id: int):
        cooperativa = self.repository.get_cooperativa(cooperativa_id)
        if cooperativa is None:
            raise HTTPException(status_code=404, detail="Cooperativa no encontrada")
        return cooperativa

    def _validar_unica(self, nombre: str | None, correo: str | None, cooperativa_id: int | None = None):
        query = self.repository.db.query(Cooperativa)
        if cooperativa_id is not None:
            query = query.filter(Cooperativa.id_cooperativa != cooperativa_id)
        if nombre and query.filter(Cooperativa.nombre.ilike(nombre.strip())).first():
            raise HTTPException(status_code=400, detail="Ya existe una cooperativa con ese nombre")
        if correo and query.filter(Cooperativa.correo.ilike(str(correo).strip())).first():
            raise HTTPException(status_code=400, detail="Ya existe una cooperativa con ese correo")

    def crear_cooperativa(self, cooperativa: CooperativaCreate):
        datos = cooperativa.model_dump()
        ubicacion_datos = datos.pop("ubicacion")
        datos["nombre"] = datos["nombre"].strip()
        datos["correo"] = str(datos["correo"]).strip().lower()
        self._validar_unica(datos["nombre"], datos["correo"])
        db = self.repository.db
        try:
            ubicacion = Ubicacion(**ubicacion_datos)
            db.add(ubicacion)
            db.flush()
            creada = Cooperativa(**datos, ubicacion_id=ubicacion.id_ubicacion)
            db.add(creada)
            db.commit()
            db.refresh(creada)
            return creada
        except Exception:
            db.rollback()
            raise

    def actualizar_cooperativa(self, cooperativa_id: int, cooperativa: CooperativaUpdate):
        actual = self.repository.get_cooperativa(cooperativa_id)
        if actual is None:
            raise HTTPException(status_code=404, detail="Cooperativa no encontrada")
        datos = cooperativa.model_dump(exclude_unset=True)
        ubicacion_datos = datos.pop("ubicacion", None)
        if "nombre" in datos:
            datos["nombre"] = datos["nombre"].strip()
        if "correo" in datos:
            datos["correo"] = str(datos["correo"]).strip().lower()
        self._validar_unica(datos.get("nombre"), datos.get("correo"), cooperativa_id)
        try:
            for campo, valor in datos.items():
                setattr(actual, campo, valor)
            if ubicacion_datos:
                for campo, valor in ubicacion_datos.items():
                    setattr(actual.ubicacion, campo, valor)
            self.repository.db.commit()
            self.repository.db.refresh(actual)
            return actual
        except Exception:
            self.repository.db.rollback()
            raise

    def eliminar_cooperativa(self, cooperativa_id: int):
        cooperativa = self.repository.get_cooperativa(cooperativa_id)
        if cooperativa is None:
            raise HTTPException(status_code=404, detail="Cooperativa no encontrada")
        db = self.repository.db
        ubicacion = cooperativa.ubicacion
        try:
            db.delete(cooperativa)
            db.flush()
            db.delete(ubicacion)
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="La cooperativa tiene rutas o cargas asociadas y no puede eliminarse",
            ) from error
        return {"mensaje": "Cooperativa eliminada"}
