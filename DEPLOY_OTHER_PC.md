# Despliegue en otro PC

Este proyecto usa Docker Compose para levantar:
- PostgreSQL
- Backend FastAPI
- Frontend Expo/React Native Web exportado y servido por Nginx

## Requisitos previos

En el PC donde vas a ejecutar todo necesitas:
- Docker instalado
- Docker Compose disponible
- Acceso a la carpeta del proyecto `coffee_fly_dios`

Si usas Windows, puedes instalar Docker Desktop.

## Pasos para ejecutar en otro PC

1. Copia o clona el proyecto al PC:
   ```powershell
   git clone <tu-repositorio> coffee_fly_dios
   cd coffee_fly_dios
   ```

2. Verifica que el archivo `docker-compose.yml` existe en la raíz del proyecto.

3. Copia `.env.example` como `.env` y cambia las contraseñas y la clave JWT. Para la versión web conserva `EXPO_PUBLIC_API_URL=/api`: Nginx dirigirá las peticiones al backend sin depender de la IP de la casa o del servidor.

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

   En Linux/macOS puedes usar `docker compose up --build -d` y comprobar `http://127.0.0.1:8080/health`.

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

1. Asegúrate de que los puertos `8080`, `8000` y `5433` estén permitidos en el firewall del PC que ejecuta Docker.
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
- Dentro de Docker el backend usa `db:5433`; PostgreSQL mantiene el mismo puerto en todo el sistema.
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

---

Si necesitas, puedo crear también un `README.md` en la raíz con los mismos pasos o un archivo `.env.example` para editar más fácil.



powershell -ExecutionPolicy Bypass -File C:\Users\SENA\Pictures\Coffee-fly\scripts\start-mobile-tunnel.ps1
