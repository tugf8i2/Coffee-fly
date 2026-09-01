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

3. Si quieres que el frontend pueda abrirse desde otro PC en la red, edita `docker-compose.yml` y cambia la URL del backend en la sección `frontend.environment`.

   Busca esta parte:
   ```yaml
   frontend:
     build:
       context: ./frontend
       args:
           EXPO_PUBLIC_API_URL: http://localhost:8000
   ```

   y reemplaza `localhost` por la IP del host donde corre Docker, por ejemplo:
   ```yaml
   frontend:
     build:
       context: ./frontend
       args:
           EXPO_PUBLIC_API_URL: http://192.168.1.10:8000
   ```

   Nota: `192.168.1.10` debe ser la dirección IP del PC que ejecuta Docker en tu red local.

4. Levanta los contenedores:
   ```powershell
   docker compose up --build -d
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

- Para comprobar que el backend responde correctamente:
  ```powershell
  curl http://<HOST_IP>:8000/
  ```
  Debe devolver:
  ```json
  {"message":"API funcionando"}
  ```

- Para comprobar que el frontend puede ver el backend, carga la app en el navegador y prueba iniciar sesión o crear datos.

## Si el host se abre en otro PC y no funciona

1. Asegúrate de que los puertos `8080`, `8000` y `5432` estén permitidos en el firewall del PC que ejecuta Docker.
2. Verifica que `EXPO_PUBLIC_API_URL` en `.env` use la IP correcta del host y no `localhost`.
3. Si cambias `EXPO_PUBLIC_API_URL`, vuelve a reconstruir el frontend:
   ```powershell
   docker compose up --build -d frontend
   ```

## Notas importantes

- PostgreSQL se expone en `127.0.0.1:5433` para evitar conflictos con instalaciones locales que usan el puerto `5432`.
  En DBeaver usa host `127.0.0.1`, puerto `5433`, base `coffeefly` y usuario `postgres`.
- Dentro de Docker los servicios siguen usando `db:5432`; no cambies esa dirección.
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