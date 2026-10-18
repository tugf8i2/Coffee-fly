"""Disposable local preview database with admin, coordinator and driver accounts."""

import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
database = Path(os.environ.get("COFFEE_FLY_PREVIEW_DB", str(root / "outputs" / "preview.sqlite3"))).resolve()
database.parent.mkdir(parents=True, exist_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{database.as_posix()}"
os.environ["ENV"] = "development"
sys.path.insert(0, str(root / "backend"))

import app.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.conductor_models import Conductor  # noqa: E402
from app.models.rol_models import Rol  # noqa: E402
from app.models.usuario_models import Usuario  # noqa: E402

Base.metadata.create_all(engine)
with SessionLocal() as db:
    roles = {}
    for name in ("registrador", "coordinador", "conductor"):
        role = db.query(Rol).filter(Rol.descripcion_rol == name).first()
        if role is None:
            role = Rol(descripcion_rol=name)
            db.add(role)
            db.flush()
        roles[name] = role
    for name, surname, email, role_name in (
        ("Admin", "Pruebas", "admin@coffeefly.com", "registrador"),
        ("Coordinador", "Pruebas", "coordinador@coffeefly.com", "coordinador"),
        ("Conductor", "Pruebas", "conductor@coffeefly.com", "conductor"),
    ):
        user = db.query(Usuario).filter(Usuario.correo_usuario == email).first()
        if user is None:
            user = Usuario(
                nombre_usuario=name, apellido=surname, correo_usuario=email,
                telefono_usuario="3000000000", contrasena=hash_password("Admin123"),
                rol=roles[role_name],
            )
            db.add(user)
            db.flush()
        if role_name == "conductor" and user.conductor is None:
            db.add(Conductor(usuario_id=user.id_usuario, licencia="B1", foto_licencia="prueba-local"))
    db.commit()
print(f"Local preview ready: {database}")
