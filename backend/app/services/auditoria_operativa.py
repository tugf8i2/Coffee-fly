from datetime import date, datetime

from app.core.time import utc_now_naive
from app.models.auditoria_operativa_models import AuditoriaOperativa


def snapshot(record, fields):
    result = {}
    for field in fields:
        value = getattr(record, field, None)
        result[field] = value.isoformat() if isinstance(value, (date, datetime)) else value
    return result


def registrar_auditoria(db, entidad, entidad_id, accion, usuario_id, antes=None, despues=None):
    db.add(AuditoriaOperativa(
        entidad=entidad, entidad_id=str(entidad_id), accion=accion,
        usuario_id=usuario_id, antes=antes, despues=despues, creado_en=utc_now_naive(),
    ))
