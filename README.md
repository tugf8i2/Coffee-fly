<p align="center">
  <img src="frontend/src/assets/brand/logo.png" width="180" alt="Logo de Coffee Fly">
</p>

# ☕ Coffee Fly

**SENA · Tecnólogo en Análisis y Desarrollo de Software · Ficha 3407179**<br>

Coffee Fly es un aplicativo de transporte y logística de café. Digitaliza la
recolección desde las zonas rurales hasta los centros de acopio, incluso con
conectividad limitada.

**Sitio web:** [https://coffee-fly.hostless.app](https://coffee-fly.hostless.app)

La documentación técnica completa está en
[Docs/DOCUMENTACION-BACKEND-FRONTEND.md](Docs/DOCUMENTACION-BACKEND-FRONTEND.md).

## ¿Qué problema resuelve?

La recolección y el transporte de café desde zonas rurales suelen coordinarse
con registros manuales y conectividad intermitente. Esto puede causar errores,
pérdida de trazabilidad, retrasos y dificultades para saber dónde está cada
carga.

Coffee Fly centraliza solicitudes, entregas, vehículos y conductores; permite
seguir viajes por GPS, actualizar estados y conservar el trabajo para
sincronizarlo cuando vuelva la conexión.

## Qué incluye

- Roles: Registrador, Caficultor, Coordinador y Conductor.
- API FastAPI, PostgreSQL y aplicación Expo para web, Android e iOS.
- Seguimiento GPS, WebSockets, cola offline cifrada y reportes.
- Llamadas de audio/vídeo con LiveKit, autorizadas por viaje.
- Sesiones revocables, contraseñas Argon2id, controles de abuso y registros JSON.

## Inicio rápido

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

- Web: `http://localhost:8080`
- API: `http://localhost:8000`
- Documentación API: `http://localhost:8000/docs`

No publiques las credenciales de ejemplo. Para una instalación real, consulta
la [guía de despliegue](Docs/HOSTLESS_DEPLOYMENT.md) y define las variables de
producción antes de abrir el servicio.

## Seguridad y operación

- La guía breve de controles, límites y respuesta a incidentes está en
  [Docs/SEGURIDAD_Y_OPERACION.md](Docs/SEGURIDAD_Y_OPERACION.md).
- El índice de documentación técnica está en [Docs/README.md](Docs/README.md).
- Las llamadas LiveKit pendientes de prueba real están en
  [Docs/MISION_LLAMADAS_LIVEKIT.md](Docs/MISION_LLAMADAS_LIVEKIT.md).

## Estructura

```text
backend/   API, autorización, servicios y migraciones
frontend/  aplicación Expo y experiencia web/móvil
infra/     motores de rutas y mapas opcionales
Docs/      operación, arquitectura y pruebas
```

## Licencia y uso

Proyecto académico y operativo de Cumbre Cafetera. No almacenes secretos,
tokens, contraseñas ni claves de proveedores en Git.
