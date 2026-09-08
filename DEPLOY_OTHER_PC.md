# Despliegue en otro PC

Este proyecto usa Docker Compose para levantar:
- PostgreSQL
- Backend FastAPI
- Frontend Expo/React Native Web exportado y servido por Nginx

## Requisitos previos

En el PC donde vas a ejecutar todo necesitas:
- Docker Desktop actualizado (Windows/macOS) o Docker Engine con el complemento
  Docker Compose v2 (Linux).
- Contenedores Linux habilitados. En Windows, Docker Desktop usa WSL 2 y la
  virtualización del equipo debe estar activa.
- Al menos 4 GB de RAM disponibles y espacio libre para las imágenes y la base.
- Acceso a la carpeta del proyecto.

No necesitas instalar Node.js, Python, Nginx ni PostgreSQL en el nuevo PC: sus
versiones están declaradas en Docker y las dependencias de aplicación están
bloqueadas en `frontend/package-lock.json` y `backend/requirements.lock.txt`.

## Pasos para ejecutar en otro PC

1. Copia o clona el proyecto al PC:
   ```powershell
   git clone <tu-repositorio> coffee_fly_dios
   cd coffee_fly_dios
   ```

2. Verifica que `docker-compose.yml`, `frontend/package-lock.json` y
   `backend/requirements.lock.txt` existan.

3. Copia `.env.example` como `.env` y cambia las contraseñas y la clave JWT. Para la versión web conserva `EXPO_PUBLIC_API_URL=/api`: Nginx dirigirá las peticiones al backend sin depender de la IP de la casa o del servidor.

   En PowerShell:
   ```powershell
   Copy-Item .env.example .env
   ```

   En Linux/macOS:
   ```bash
   cp .env.example .env
   ```

   ```env
   EXPO_PUBLIC_API_URL=/api
   POSTGRES_PASSWORD=una-clave-segura
   ENV=production
   JWT_SECRET_KEY=una-clave-aleatoria-larga-y-privada
   BOOTSTRAP_REGISTRADOR_PASSWORD=otra-clave-segura
   CORS_ORIGINS=https://coffee.midominio.com
   ALLOWED_HOSTS=coffee.midominio.com
   ```

   En un APK o Expo Go sí debes usar una URL absoluta alcanzable desde el teléfono; para producción usa un dominio HTTPS estable.
   Usa una contraseña de PostgreSQL alfanumérica larga en este Compose; caracteres reservados de URL como `@`, `:` o `/` deben codificarse.

4. En Windows, ejecuta el despliegue asistido. Valida Docker, construye, espera la base de datos y comprueba toda la ruta navegador -> Nginx -> FastAPI -> PostgreSQL:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
   ```

   En Linux/macOS puedes usar:
   ```bash
   docker compose config --quiet
   docker compose pull
   docker compose build --pull
   docker compose up -d
   curl --fail http://127.0.0.1:8080/health
   ```

5. Revisa que los servicios estén corriendo:
   ```powershell
   docker compose ps
   ```

6. Abre el navegador en el otro PC y carga la app:
   - Frontend: `http://<HOST_IP>:8080`
   - Backend (opcional): `http://<HOST_IP>:8000`

   Ejemplo:
   ```text
   http://192.168.1.10:8080
   ```

## Verificación

- Para ejecutar solamente el diagnóstico en Windows:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\preflight.ps1 -PublicUrl http://127.0.0.1:8080
  ```
  Debe devolver:
  `Diagnóstico terminado: el entorno está listo.`

- Para comprobar que el frontend puede ver el backend, carga la app en el navegador y prueba iniciar sesión o crear datos.

## Si el host se abre en otro PC y no funciona

1. Para acceder desde otro equipo, permite `8080` en el firewall del PC que
   ejecuta Docker. Abre `8000` solo si también necesitas acceder directamente a
   la API. PostgreSQL (`5433`) está enlazado únicamente a `127.0.0.1` y no se
   expone a la red local.
2. Verifica que `EXPO_PUBLIC_API_URL=/api`; no uses `localhost:8000` en el export web.
3. Comprueba el estado y los logs:
   ```powershell
   docker compose ps
   docker compose logs --tail 100 backend frontend db
   ```

## Notas importantes

- PostgreSQL se expone en `127.0.0.1:5433` para evitar conflictos con instalaciones locales que usan el puerto `5432`.
  En DBeaver usa host `127.0.0.1`, puerto `5433`, base `coffeefly`, usuario `postgres` y contraseña `1234`.
- En una instalación nueva, entra con `admin@coffeefly.com` y `Admin123`.
- Dentro de Docker el backend usa `db:5432`, el puerto estándar de PostgreSQL.
  `5433` es únicamente el puerto publicado en el PC para herramientas como DBeaver.
- Si en otro equipo `5433` también estuviera ocupado, ejecuta `POSTGRES_HOST_PORT=5434 docker compose up -d`
  y usa ese mismo puerto en DBeaver.
- El archivo `backend/BaseDatos.sql` se ejecuta solo la primera vez que el volumen de Postgres se crea.
- Si quieres reiniciar la base de datos desde cero:
  ```powershell
  # DESTRUCTIVO: crea primero una copia; elimina todo el volumen PostgreSQL.
  docker compose down -v
  docker compose up --build -d
  ```
- El frontend se sirve en `http://<HOST_IP>:8080` y el backend en `http://<HOST_IP>:8000`.
- Las imágenes fijadas actualmente son PostgreSQL 16.15, Python 3.11.16,
  Node.js 22.23.2 y Nginx 1.30.4. No cambies PostgreSQL a otra versión mayor sin
  hacer antes una migración o una exportación/importación de la base.

## Comandos útiles

- Ver logs:
  ```powershell
  docker compose logs -f
  ```

- Parar todo:
  ```powershell
  docker compose down
  ```

- Volver a crear todo desde cero:
  ```powershell
  # DESTRUCTIVO: no usar para detener normalmente el proyecto.
  docker compose down -v
  docker compose up --build -d
  ```

- Descargar parches de las imágenes fijadas y reconstruir sin reutilizar capas:
  ```powershell
  docker compose pull
  docker compose build --pull --no-cache
  docker compose up -d
  ```

---
