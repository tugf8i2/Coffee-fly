import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

import app.models  # noqa: F401 - registra todos los modelos y relaciones
from app.api.carga_api import router as carga_router
from app.api.conductor_api import router as conductor_router
from app.api.cooperativa_api import router as cooperativa_router
from app.api.dashboard_api import router as dashboard_router
from app.api.entrega_api import router as entrega_router
from app.api.historial_eventos_api import router as historial_eventos_router
from app.api.login_api import router as login_router
from app.api.monitoring_api import router as monitoring_router
from app.api.realtime_api import router as realtime_router
from app.api.reportes_api import router as reportes_router
from app.api.rol_api import router as rol_router
from app.api.ruta_api import router as ruta_router
from app.api.solicitud_api import router as solicitud_router
from app.api.ubicacion_api import router as ubicacion_router
from app.api.usuario_api import router as usuario_router
from app.api.vehiculo_api import router as vehiculo_router
from app.core.config import IS_PRODUCTION, allowed_hosts, cors_origin_regex, cors_origins
from app.core.database import SessionLocal
from app.core.observability import (
    database_error_handler,
    http_error_handler,
    request_observability_middleware,
    unexpected_error_handler,
    validation_error_handler,
)
from app.core.security import hash_password
from app.models.rol_models import Rol
from app.models.usuario_models import Usuario


def bootstrap_registrador() -> None:
    """Crea el primer Registrador únicamente con credenciales del entorno."""
    with SessionLocal() as db:
        role = db.query(Rol).filter(Rol.descripcion_rol.ilike("registrador")).first()
        if role is None or db.query(Usuario).filter(Usuario.rol_id == role.id_rol).first():
            return
        email = os.getenv("BOOTSTRAP_REGISTRADOR_EMAIL", "").strip().lower()
        password = os.getenv("BOOTSTRAP_REGISTRADOR_PASSWORD", "")
        if not email or not password:
            return
        db.add(Usuario(
            nombre_usuario=os.getenv("BOOTSTRAP_REGISTRADOR_NOMBRE", "Administrador"),
            apellido=os.getenv("BOOTSTRAP_REGISTRADOR_APELLIDO", "CoffeeFly"),
            correo_usuario=email,
            telefono_usuario=os.getenv("BOOTSTRAP_REGISTRADOR_TELEFONO", "3000000000"),
            contrasena=hash_password(password),
            rol_id=role.id_rol,
        ))
        db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    bootstrap_registrador()
    yield


app = FastAPI(
    title="Coffee Fly API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
app.middleware("http")(request_observability_middleware)
app.add_exception_handler(HTTPException, http_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(SQLAlchemyError, database_error_handler)
app.add_exception_handler(Exception, unexpected_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts())


@app.get("/")
def home():
    return {"message": "API funcionando"}


@app.get("/health/live", include_in_schema=False)
def health_live():
    return {"status": "ok"}


@app.get("/health/ready", include_in_schema=False)
def health_ready():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}


for router in (
    login_router,
    rol_router,
    usuario_router,
    conductor_router,
    cooperativa_router,
    ubicacion_router,
    ruta_router,
    vehiculo_router,
    carga_router,
    solicitud_router,
    historial_eventos_router,
    entrega_router,
    reportes_router,
    dashboard_router,
    realtime_router,
    monitoring_router,
):
    app.include_router(router)
