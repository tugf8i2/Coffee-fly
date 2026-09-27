# Despliegue de Coffee Fly en Hostless

Coffee Fly se entrega como una sola aplicación Docker: FastAPI sirve la API,
los WebSockets y la exportación web de Expo. Esto mantiene el mismo origen y
evita depender de un proxy adicional.

## Recursos

1. Crear una base PostgreSQL administrada en Hostless.
2. Crear una App desde este repositorio y seleccionar Docker.
3. Enlazar la base a la App para que Hostless inyecte `DATABASE_URL`.

El archivo `hostless.yaml` configura el Dockerfile, una réplica y la sonda
`/health/ready`. El contenedor detecta una base totalmente vacía, instala el
esquema inicial una sola vez y después ejecuta todas las migraciones Alembic.

## Variables secretas de la App

- `ENV=production`
- `DATABASE_URL` (inyectada al enlazar PostgreSQL)
- `JWT_SECRET_KEY` (valor aleatorio largo, nunca versionado)
- `CORS_ORIGINS=https://<dominio-hostless>`
- `ALLOWED_HOSTS=<dominio-hostless>`
- `BOOTSTRAP_REGISTRADOR_EMAIL=<correo inicial>`
- `BOOTSTRAP_REGISTRADOR_PASSWORD=<contraseña inicial segura>`

Opcionales: `BOOTSTRAP_REGISTRADOR_NOMBRE`,
`BOOTSTRAP_REGISTRADOR_APELLIDO`, `ROUTING_PROVIDER` y `ROUTING_URL`.

El primer registrador solo se crea si no existe ninguno y ambas credenciales
de bootstrap están presentes. Después del primer acceso conviene retirar la
contraseña de bootstrap del entorno.

## Verificación

- `GET /` carga la aplicación web.
- `GET /health/ready` devuelve `status=ready` y `database=ok`.
- `GET /api/health/ready` permite comprobar la API desde el mismo dominio.
- El APK debe usar `EXPO_PUBLIC_API_URL=https://<dominio-hostless>/api`.
