"""Validaciones autoritativas de carga, vehículo y conductor para Coffee Fly."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_

from app.models.viaje_models import Viaje


LICENCIAS_PERMITIDAS = {
    "A1": {"A1"}, "A2": {"A2", "A1"},
    "B1": {"B1"}, "B2": {"B2", "B1"}, "B3": {"B3", "B2", "B1"},
    "C1": {"C1", "B1"},
    "C2": {"C2", "C1", "B2", "B1"},
    "C3": {"C3", "C2", "C1", "B3", "B2", "B1"},
}
ESTADOS_RESERVADOS = ("asignado", "en_cola", "en_camino")


def hoy_colombia():
    # Colombia no aplica horario de verano; evita depender de tzdata en Windows.
    return datetime.now(timezone(timedelta(hours=-5))).date()


def licencia_compatible(categoria: str | None, requerida: str | None):
    return bool(categoria and requerida and requerida in LICENCIAS_PERMITIDAS.get(categoria.upper(), set()))


def capacidad_calculada(tara_kg, pbv_homologado_kg, pbv_maximo_legal_kg):
    tara, homologado = float(tara_kg), float(pbv_homologado_kg)
    if tara <= 0 or homologado <= 0:
        raise HTTPException(status_code=400, detail="Tara y PBV homologado deben ser mayores que cero")
    limite = min(homologado, float(pbv_maximo_legal_kg)) if pbv_maximo_legal_kg else homologado
    capacidad = round(limite - tara, 2)
    if capacidad <= 0:
        raise HTTPException(status_code=400, detail="La tara debe ser menor que el límite de PBV del vehículo")
    return capacidad


def viaje_reservado(db, *, vehiculo_id=None, conductor_id=None):
    conditions = []
    if vehiculo_id is not None:
        conditions.append(Viaje.vehiculo_id == vehiculo_id)
    if conductor_id is not None:
        conditions.append(Viaje.conductor_id == conductor_id)
    if not conditions:
        return False
    return db.query(Viaje.id_viaje).filter(Viaje.estado_viaje.in_(ESTADOS_RESERVADOS), or_(*conditions)).first() is not None


def evaluar_vehiculo(db, vehiculo, peso_kg=None, cooperativa_id=None):
    motivos = []
    catalogo = vehiculo.configuracion_catalogo
    if vehiculo.estado_vehiculo not in ("disponible", "en camino"):
        motivos.append("El vehículo no está disponible para programación.")
    if cooperativa_id is not None and vehiculo.cooperativa_id not in (None, cooperativa_id):
        motivos.append("El vehículo pertenece a otra cooperativa.")
    if not catalogo or not catalogo.activo or vehiculo.tipo_servicio not in ("PUBLICO", "PARTICULAR"):
        motivos.append("Falta una configuración vehicular y tipo de servicio válidos.")
    if not vehiculo.tara_kg or not vehiculo.pbv_homologado_kg:
        motivos.append("Faltan tara o PBV homologado verificados.")
    elif catalogo:
        try:
            calculada = capacidad_calculada(vehiculo.tara_kg, vehiculo.pbv_homologado_kg, catalogo.pbv_maximo_legal_kg)
            if abs(calculada - float(vehiculo.capacidad_kg)) > 0.01:
                motivos.append("La capacidad registrada no coincide con el PBV y la tara.")
        except HTTPException as error:
            motivos.append(error.detail)
    if peso_kg is not None:
        if float(peso_kg) <= 0:
            motivos.append("El peso de la carga debe ser mayor que cero.")
        elif float(peso_kg) > float(vehiculo.capacidad_kg):
            motivos.append(f"La carga de {float(peso_kg):,.0f} kg supera la capacidad útil de {float(vehiculo.capacidad_kg):,.0f} kg.")
    for field, label in (("soat_vencimiento", "SOAT"), ("tecnomecanica_vencimiento", "técnico-mecánica"), ("seguro_vencimiento", "seguro")):
        expires = getattr(vehiculo, field)
        if expires is None:
            motivos.append(f"Falta la fecha de vencimiento del {label}.")
        elif expires < hoy_colombia():
            motivos.append(f"El {label} está vencido.")
    return {"compatible": not motivos, "motivos": motivos,
            "capacidad_restante_kg": max(0, float(vehiculo.capacidad_kg) - float(peso_kg or 0)),
            "licencia_requerida": vehiculo.licencia_minima_requerida}


def evaluar_conductor(db, conductor, vehiculo, cooperativa_id=None):
    motivos = []
    if conductor is None:
        return {"compatible": False, "motivos": ["El conductor no tiene perfil registrado."]}
    usuario = conductor.usuarios
    if not usuario or not usuario.habilitado or not usuario.rol or usuario.rol.descripcion_rol.lower() != "conductor":
        motivos.append("El conductor no está habilitado para conducir.")
    if (conductor.estado_conductor or "disponible") not in ("disponible", "asignado"):
        motivos.append("El conductor no está disponible.")
    if db.query(Viaje.id_viaje).filter(Viaje.conductor_id == conductor.id_conductor, Viaje.estado_viaje == "en_camino").first():
        motivos.append("El conductor ya está en un viaje activo.")
    if cooperativa_id is not None and conductor.cooperativa_id not in (None, cooperativa_id):
        motivos.append("El conductor pertenece a otra cooperativa.")
    if not conductor.foto_licencia or not conductor.numero_licencia:
        motivos.append("Faltan el número o la imagen de la licencia.")
    if not licencia_compatible(conductor.licencia, vehiculo.licencia_minima_requerida):
        motivos.append(f"El vehículo requiere licencia {vehiculo.licencia_minima_requerida or 'válida'} y el conductor posee {conductor.licencia or 'ninguna'}.")
    if conductor.fecha_vencimiento_licencia is None:
        motivos.append("Falta la fecha de vencimiento de la licencia.")
    elif conductor.fecha_vencimiento_licencia < hoy_colombia():
        motivos.append("La licencia del conductor está vencida.")
    if conductor.fecha_expedicion_licencia and conductor.fecha_vencimiento_licencia and conductor.fecha_expedicion_licencia > conductor.fecha_vencimiento_licencia:
        motivos.append("Las fechas de la licencia no son válidas.")
    return {"compatible": not motivos, "motivos": motivos}
