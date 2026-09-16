from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.models.configuracion_vehicular_models import ConfiguracionVehicular
from app.models.cooperativa_models import Cooperativa
from app.models.vehiculo_models import Vehiculo
from app.schemas.vehiculo_schemas import VehiculoCreate, VehiculoUpdate
from app.services.auditoria_operativa import registrar_auditoria, snapshot
from app.services.compatibilidad_transporte import capacidad_calculada, evaluar_vehiculo, viaje_reservado


AUDIT_FIELDS = (
    "placa", "tipo_vehiculo", "marca", "modelo_comercial", "modelo", "tipo_servicio",
    "configuracion", "tara_kg", "pbv_homologado_kg", "capacidad_kg", "estado_vehiculo",
    "soat_vencimiento", "tecnomecanica_vencimiento", "seguro_vencimiento", "cooperativa_id",
)


class VehiculoService:
    def __init__(self, db: Session):
        self.db = db

    def obtener_vehiculos(self, skip=0, limit=100):
        return self.db.query(Vehiculo).order_by(Vehiculo.placa).offset(skip).limit(limit).all()

    def obtener_vehiculo(self, id_vehiculo):
        vehiculo = self.db.get(Vehiculo, id_vehiculo)
        if not vehiculo:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado")
        return vehiculo

    def catalogo(self):
        return self.db.query(ConfiguracionVehicular).order_by(ConfiguracionVehicular.codigo).all()

    def actualizar_catalogo(self, codigo, datos, usuario_id):
        catalogo = self.db.get(ConfiguracionVehicular, codigo)
        if not catalogo:
            raise HTTPException(status_code=404, detail="Configuración no encontrada")
        if codigo != "LIVIANO" and datos.pbv_maximo_legal_kg is None:
            raise HTTPException(status_code=400, detail="La configuración pesada requiere PBV máximo")
        antes = snapshot(catalogo, ("descripcion", "pbv_maximo_legal_kg", "licencia_particular", "licencia_publico", "activo"))
        for key, value in datos.model_dump().items():
            setattr(catalogo, key, value)
        registrar_auditoria(self.db, "configuracion_vehicular", codigo, "actualizar", usuario_id,
                            antes, snapshot(catalogo, antes))
        self.db.commit()
        return catalogo

    def _preparar(self, datos):
        codigo = datos.get("configuracion")
        catalogo = self.db.get(ConfiguracionVehicular, codigo)
        if not catalogo or not catalogo.activo:
            raise HTTPException(status_code=400, detail="Selecciona una configuración vehicular activa")
        tipos = {"liviano": {"Camioneta", "Van"}, "rigido": {"Camión"}, "articulado": {"Tractomula"}}
        if datos["tipo_vehiculo"] not in tipos.get(catalogo.clase_vehiculo, set()):
            raise HTTPException(status_code=400, detail="El tipo de vehículo no coincide con la configuración seleccionada")
        if datos.get("cooperativa_id") is not None and self.db.get(Cooperativa, datos["cooperativa_id"]) is None:
            raise HTTPException(status_code=400, detail="La cooperativa no existe")
        if catalogo.numero_ejes is not None and datos.get("numero_ejes") not in (None, catalogo.numero_ejes):
            raise HTTPException(status_code=400, detail="El número de ejes no coincide con la configuración")
        datos["numero_ejes"] = catalogo.numero_ejes or datos.get("numero_ejes")
        datos["clase_vehiculo"] = catalogo.clase_vehiculo
        datos["capacidad_kg"] = capacidad_calculada(datos["tara_kg"], datos["pbv_homologado_kg"], catalogo.pbv_maximo_legal_kg)
        datos["placa"] = datos["placa"].strip().upper()
        if not datos.get("modelo"):
            raise HTTPException(status_code=400, detail="El año de modelo es obligatorio")
        return datos

    def crear_vehiculo(self, vehiculo: VehiculoCreate, usuario_id=None):
        datos = self._preparar(vehiculo.model_dump())
        if self.db.query(Vehiculo.id_vehiculo).filter(Vehiculo.placa.ilike(datos["placa"])).first():
            raise HTTPException(status_code=400, detail="La placa ya está registrada")
        now = utc_now_naive()
        record = Vehiculo(**datos, creado_en=now, actualizado_en=now, creado_por=usuario_id, actualizado_por=usuario_id)
        self.db.add(record)
        self.db.flush()
        registrar_auditoria(self.db, "vehiculo", record.id_vehiculo, "crear", usuario_id,
                            despues=snapshot(record, AUDIT_FIELDS))
        self.db.commit()
        self.db.refresh(record)
        return record

    def actualizar_vehiculo(self, id_vehiculo: int, vehiculo: VehiculoUpdate, usuario_id=None):
        record = self.obtener_vehiculo(id_vehiculo)
        if viaje_reservado(self.db, vehiculo_id=id_vehiculo):
            raise HTTPException(status_code=409, detail="No se pueden cambiar datos de un vehículo con viaje asignado o en ruta")
        antes = snapshot(record, AUDIT_FIELDS)
        datos = {**{key: getattr(record, key) for key in AUDIT_FIELDS if key not in ("capacidad_kg", "clase_vehiculo")},
                 "color": record.color, "numero_ejes": record.numero_ejes, "tipo_carroceria": record.tipo_carroceria}
        datos.update(vehiculo.model_dump(exclude_unset=True))
        for required in ("configuracion", "tipo_servicio", "tara_kg", "pbv_homologado_kg"):
            if datos.get(required) is None:
                raise HTTPException(status_code=400, detail=f"Falta {required} para calcular la capacidad")
        datos = self._preparar(datos)
        duplicate = self.db.query(Vehiculo).filter(Vehiculo.placa.ilike(datos["placa"]), Vehiculo.id_vehiculo != id_vehiculo).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="La placa ya está registrada")
        for key, value in datos.items():
            if key in Vehiculo.__table__.columns:
                setattr(record, key, value)
        record.actualizado_en = utc_now_naive(); record.actualizado_por = usuario_id
        registrar_auditoria(self.db, "vehiculo", id_vehiculo, "actualizar", usuario_id,
                            antes, snapshot(record, AUDIT_FIELDS))
        self.db.commit()
        self.db.refresh(record)
        return record

    def eliminar_vehiculo(self, id_vehiculo: int, usuario_id=None):
        record = self.obtener_vehiculo(id_vehiculo)
        if viaje_reservado(self.db, vehiculo_id=id_vehiculo):
            raise HTTPException(status_code=409, detail="No se puede desactivar un vehículo con viaje activo")
        antes = snapshot(record, AUDIT_FIELDS)
        record.estado_vehiculo = "inactivo"; record.actualizado_en = utc_now_naive()
        registrar_auditoria(self.db, "vehiculo", id_vehiculo, "desactivar", usuario_id,
                            antes, snapshot(record, AUDIT_FIELDS))
        self.db.commit()
        return {"mensaje": "Vehículo desactivado; se conservó su historial"}

    def compatibilidad(self, peso_kg, cooperativa_id=None):
        if peso_kg <= 0:
            raise HTTPException(status_code=400, detail="El peso debe ser mayor que cero")
        return [dict(id_vehiculo=item.id_vehiculo, placa=item.placa, tipo_vehiculo=item.tipo_vehiculo,
                     configuracion=item.configuracion, capacidad_kg=float(item.capacidad_kg),
                     estado_vehiculo=item.estado_vehiculo,
                     **evaluar_vehiculo(self.db, item, peso_kg, cooperativa_id))
                for item in self.obtener_vehiculos(limit=1000)]
