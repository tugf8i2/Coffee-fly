from collections import defaultdict
from datetime import date, datetime, time, timedelta
from app.services.exportacion_reportes import crear_excel, crear_pdf

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.cooperativa_models import Cooperativa

from app.core.auth import require_roles
from app.core.database import get_db
from app.models.carga_models import Carga
from app.models.entrega_models import Entrega
from app.models.solicitud_models import Solicitud
from app.models.usuario_models import Usuario
from app.models.vehiculo_models import Vehiculo


router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get('/registros/exportar')
def exportar_registros(formato: str, db: Session = Depends(get_db),
                      _registrador: Usuario = Depends(require_roles('registrador'))):
    if formato not in ('pdf', 'excel'):
        raise HTTPException(status_code=400, detail="El formato debe ser 'pdf' o 'excel'")
    roles = dict(db.query(Usuario.rol_id, func.count(Usuario.id_usuario)).group_by(Usuario.rol_id).all())
    filas = [
        ['Cooperativas', db.query(func.count(Cooperativa.id_cooperativa)).scalar() or 0],
        ['Vehículos', db.query(func.count(Vehiculo.id_vehiculo)).scalar() or 0],
        ['Coordinadores', roles.get(1, 0)], ['Conductores', roles.get(2, 0)],
        ['Registradores', roles.get(3, 0)], ['Caficultores', roles.get(4, 0)],
    ]
    periodo = {'desde': date.today(), 'hasta': date.today()}
    sections = [('Resumen de registros', ['Categoría', 'Cantidad'], filas)]
    nota = 'Registros existentes al momento de la consulta. No representa altas del día.'
    content = crear_pdf(periodo, sections, nota) if formato == 'pdf' else crear_excel(periodo, sections, nota)
    extension = 'pdf' if formato == 'pdf' else 'xlsx'
    media = 'application/pdf' if formato == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    return Response(content, media_type=media, headers={'Content-Disposition': f'attachment; filename="CoffeeFly_registros_{date.today()}.{extension}"'})


def _periodo(fecha_desde: date | None, fecha_hasta: date | None):
    final = fecha_hasta or date.today()
    inicial = fecha_desde or final
    if final < inicial:
        raise HTTPException(status_code=400, detail="La fecha final debe ser posterior a la inicial")
    if final - inicial >= timedelta(days=30):
        raise HTTPException(status_code=400, detail="El período máximo del reporte es de 30 días")
    return datetime.combine(inicial, time.min), datetime.combine(final + timedelta(days=1), time.min)


def _datos_reporte(db: Session, fecha_desde: date | None, fecha_hasta: date | None):
    inicio, fin = _periodo(fecha_desde, fecha_hasta)
    filas = db.query(Entrega, Usuario, Vehiculo).join(
        Usuario, Entrega.caficultor_id == Usuario.id_usuario
    ).join(Solicitud, Entrega.solicitud_id == Solicitud.id_solicitud).outerjoin(
        Carga, Solicitud.carga_id == Carga.id_carga
    ).outerjoin(Vehiculo, Carga.vehiculo_id == Vehiculo.id_vehiculo).filter(
        Entrega.fecha_hora_entrega >= inicio,
        Entrega.fecha_hora_entrega < fin,
        Entrega.estado_entrega != "cancelado",
    ).order_by(Entrega.fecha_hora_entrega.asc()).all()

    cafe_por_caficultor = defaultdict(float)
    entregas_por_vehiculo = defaultdict(lambda: {"entregas": 0, "kilogramos": 0.0})
    resumen_diario = defaultdict(lambda: {"entregas": 0, "kilogramos": 0.0})
    for entrega, caficultor, vehiculo in filas:
        kg = float(entrega.cantidad_kg)
        nombre = f"{caficultor.nombre_usuario} {caficultor.apellido}".strip()
        cafe_por_caficultor[nombre] += kg
        placa = vehiculo.placa if vehiculo else "Sin vehículo asignado"
        entregas_por_vehiculo[placa]["entregas"] += 1
        entregas_por_vehiculo[placa]["kilogramos"] += kg
        dia = entrega.fecha_hora_entrega.date().isoformat()
        resumen_diario[dia]["entregas"] += 1
        resumen_diario[dia]["kilogramos"] += kg
    return {
        "periodo": {"desde": inicio.date(), "hasta": (fin - timedelta(days=1)).date()},
        "cafe_por_caficultor": [
            {"caficultor": nombre, "kilogramos": round(kg, 2)}
            for nombre, kg in sorted(cafe_por_caficultor.items())
        ],
        "entregas_por_vehiculo": [
            {"vehiculo": placa, "entregas": datos["entregas"], "kilogramos": round(datos["kilogramos"], 2)}
            for placa, datos in sorted(entregas_por_vehiculo.items())
        ],
        "resumen_diario": [
            {"fecha": dia, "entregas": datos["entregas"], "kilogramos": round(datos["kilogramos"], 2)}
            for dia, datos in sorted(resumen_diario.items())
        ],
    }


def _filas(datos):
    return [
        ("Café recolectado por caficultor", ["Caficultor", "Kilogramos"],
         [[x["caficultor"], x["kilogramos"]] for x in datos["cafe_por_caficultor"]]),
        ("Recolecciones por vehículo", ["Vehículo", "Recolecciones", "Kilogramos"],
         [[x["vehiculo"], x["entregas"], x["kilogramos"]] for x in datos["entregas_por_vehiculo"]]),
        ("Resumen diario de operaciones", ["Fecha", "Recolecciones", "Kilogramos"],
         [[x["fecha"], x["entregas"], x["kilogramos"]] for x in datos["resumen_diario"]]),
    ]


@router.get("/")
def generar_reporte(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    return _datos_reporte(db, fecha_desde, fecha_hasta)


@router.get("/exportar")
def exportar_reporte(
    formato: str,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    db: Session = Depends(get_db),
    _coordinador: Usuario = Depends(require_roles("coordinador")),
):
    datos = _datos_reporte(db, fecha_desde, fecha_hasta)
    nombre = f"reporte_operaciones_{datetime.now().strftime('%Y-%m-%d')}"
    if formato == "excel":
        contenido = crear_excel(datos['periodo'], _filas(datos))
        media, extension = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    elif formato == "pdf":
        contenido = crear_pdf(datos['periodo'], _filas(datos))
        media, extension = "application/pdf", "pdf"
    else:
        raise HTTPException(status_code=400, detail="El formato debe ser 'pdf' o 'excel'")
    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 5 MB")
    return Response(contenido, media_type=media, headers={"Content-Disposition": f'attachment; filename="{nombre}.{extension}"'})
