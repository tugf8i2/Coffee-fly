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

## Preflight automatizado

La clave de despliegue se guarda fuera del repositorio en
`%USERPROFILE%\.hostless\hostless-token.txt`; el archivo debe contener únicamente
la API key `hlk_...`. Para comprobar la autenticación y enumerar los proyectos
sin crear ni modificar recursos:

```powershell
.\scripts\hostless-preflight.ps1
```

Después de elegir el identificador de proyecto, el mismo script puede revisar
si ya existen una App o una base de datos para evitar duplicarlas:

```powershell
.\scripts\hostless-preflight.ps1 -ProjectId '<project-id>'
```

El script no imprime la clave y todas sus operaciones son de solo lectura.

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
