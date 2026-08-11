from fastapi import FastAPI
from app.api.rol_api import router as rol_router
from app.api.usuario_api import router as usuario_router
from app.api.conductor_api import router as conductor_router
from app.api.cooperativa_api import (router as cooperativa_api)
from app.api.ubicacion_api import (router as ubicacion_router)
from app.api.ruta_api import (router as ruta_router)
from app.api.vehiculo_api import (router as vehiculo_router)
from app.api.carga_api import (router as carga_router)
from app.api.solicitud_api import (router as solicitud_router)
from app.api.historial_eventos_api import (router as historial_eventos_api)
import app.models
from app.core.database import Base, engine


from fastapi import FastAPI
from app.api.login_api import router as login_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


@app.on_event("startup")
def create_support_tables():
    Base.metadata.create_all(bind=engine)

# 🔥 CORS (aquí mismo, después de crear app)
app.add_middleware(
    CORSMiddleware,
    # frontend (Vite React) — incluir localhost y 127.0.0.1 y puertos alternativos usados en desarrollo
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.get("/")
def home():
    return {"message": "API funcionando"}




app.include_router(
    login_router
        )

app.include_router(
    rol_router
)

app.include_router(
    usuario_router
)

app.include_router(
    conductor_router
)

app.include_router(
    cooperativa_api
)



app.include_router(
    ubicacion_router
)

app.include_router(
    ruta_router
)

app.include_router(
    vehiculo_router
)

app.include_router(
    carga_router
)

app.include_router(
    solicitud_router
)

app.include_router(
    historial_eventos_api
)

