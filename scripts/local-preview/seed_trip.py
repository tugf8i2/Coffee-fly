"""Create an isolated assigned trip for testing the conductor APK locally."""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[2]
os.environ["DATABASE_URL"] = f"sqlite:///{(root / 'outputs' / 'preview.sqlite3').as_posix()}"
os.environ["ENV"] = "development"
sys.path.insert(0, str(root / "backend"))

import app.models  # noqa: E402,F401
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.carga_models import Carga  # noqa: E402
from app.models.configuracion_vehicular_models import ConfiguracionVehicular  # noqa: E402
from app.models.cooperativa_models import Cooperativa  # noqa: E402
from app.models.entrega_models import Entrega  # noqa: E402
from app.models.rol_models import Rol  # noqa: E402
from app.models.solicitud_models import Solicitud  # noqa: E402
from app.models.ubicacion_models import Ubicacion  # noqa: E402
from app.models.usuario_models import Usuario  # noqa: E402
from app.models.vehiculo_models import Vehiculo  # noqa: E402
from app.models.viaje_models import Viaje  # noqa: E402

now = datetime.now(timezone.utc).replace(tzinfo=None)
expires = (now + timedelta(days=365)).date()

with SessionLocal() as db:
    admin = db.query(Usuario).filter_by(correo_usuario="admin@coffeefly.com").one()
    driver = db.query(Usuario).filter_by(correo_usuario="conductor@coffeefly.com").one()
    assigned = db.query(Viaje).filter_by(conductor_id=driver.conductor.id_conductor, estado_viaje="asignado").first()
    if assigned:
        print(f"Assigned local trip already exists: {assigned.id_viaje}")
        sys.exit(0)

    role = db.query(Rol).filter_by(descripcion_rol="caficultor").first()
    if role is None:
        role = Rol(descripcion_rol="caficultor")
        db.add(role)
        db.flush()
    farmer = db.query(Usuario).filter_by(correo_usuario="finca.pruebas@coffeefly.com").first()
    if farmer is None:
        farmer = Usuario(nombre_usuario="Finca", apellido="Pruebas", correo_usuario="finca.pruebas@coffeefly.com",
                         telefono_usuario="3000000001", contrasena=hash_password("Admin123"), rol=role,
                         latitud_finca=4.6602, longitud_finca=-74.0934, direccion_finca="Punto de prueba",
                         municipio="Bogotá", departamento="Cundinamarca", ubicacion_finca_actualizada_en=now)
        db.add(farmer)
        db.flush()
    place = Ubicacion(x=-74.0840, y=4.6670, departamento="Cundinamarca", ciudad="Bogotá",
                      direccion="Destino de prueba")
    db.add(place)
    db.flush()
    cooperative = Cooperativa(nombre="Cooperativa de prueba local", telefono="3000000002",
                              correo="coop@coffeefly.com", ubicacion_id=place.id_ubicacion)
    db.add(cooperative)
    config = db.query(ConfiguracionVehicular).filter_by(codigo="N1TEST").first()
    if config is None:
        config = ConfiguracionVehicular(codigo="N1TEST", descripcion="Vehículo de prueba local", clase_vehiculo="camioneta",
                                        numero_ejes=2, pbv_maximo_legal_kg=3000, licencia_particular="B1",
                                        licencia_publico="C1", activo=True)
        db.add(config)
    vehicle = Vehiculo(placa="TST123", tipo_vehiculo="camioneta", capacidad_kg=1000,
                       estado_vehiculo="disponible", configuracion="N1TEST", tipo_servicio="PARTICULAR",
                       tara_kg=1500, pbv_homologado_kg=2500, soat_vencimiento=expires,
                       tecnomecanica_vencimiento=expires, seguro_vencimiento=expires,
                       cooperativa_id=cooperative.id_cooperativa, propietario_nombre="Prueba local")
    db.add(vehicle)
    driver.conductor.numero_licencia = "TEST123"
    driver.conductor.fecha_vencimiento_licencia = expires
    driver.conductor.estado_conductor = "disponible"
    db.flush()
    load = Carga(peso_kg=100, descripcion="Café de prueba local", caficultor_id=farmer.id_usuario,
                 cooperativa_id=cooperative.id_cooperativa)
    db.add(load)
    db.flush()
    request = Solicitud(estado_solicitud="pendiente", fecha_hora_solicitud=now,
                        caficultor_id=farmer.id_usuario, carga_id=load.id_carga)
    db.add(request)
    db.flush()
    trip = Viaje(vehiculo_id=vehicle.id_vehiculo, conductor_id=driver.conductor.id_conductor,
                 coordinador_id=admin.id_usuario, cooperativa_id=cooperative.id_cooperativa,
                 cooperativa_latitud_snapshot=4.6670, cooperativa_longitud_snapshot=-74.0840,
                 cooperativa_direccion_snapshot="Destino de prueba, Bogotá", estado_viaje="asignado",
                 orden_cola=1, creado_en=now)
    db.add(trip)
    db.flush()
    delivery = Entrega(solicitud_id=request.id_solicitud, caficultor_id=farmer.id_usuario,
                       cantidad_kg=100, fecha_hora_entrega=now, estado_entrega="pendiente",
                       viaje_id=trip.id_viaje, orden_recoleccion=1, finca_latitud_snapshot=4.6602,
                       finca_longitud_snapshot=-74.0934, finca_direccion_snapshot="Punto de prueba, Bogotá",
                       finca_ubicacion_snapshot_en=now)
    db.add(delivery)
    db.commit()
    print(f"Assigned local trip: {trip.id_viaje}")
