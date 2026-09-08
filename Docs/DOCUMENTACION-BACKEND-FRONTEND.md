# Coffee Fly: documentación completa del backend y el front-end

## 1. Propósito y alcance

Coffee Fly administra la recolección y el transporte de café desde la finca de
un caficultor hasta una cooperativa. Este documento explica únicamente las dos
aplicaciones ejecutables del proyecto:

- `backend`: API REST y WebSocket, reglas de negocio, seguridad y persistencia.
- `frontend`: aplicación React Native con Expo para Android, iOS y web.

La base PostgreSQL se describe porque forma parte del funcionamiento del
backend. Los documentos académicos y diagramas externos no forman parte de
esta guía.

## 2. Arquitectura general

```text
Usuario en Android, iOS o navegador
                │
                ▼
     Front-end React Native / Expo
       │ REST/JSON       │ WebSocket
       │                 │ seguimiento
       ▼                 ▼
          Backend FastAPI
       API → servicio → repositorio
                │
                ▼
          PostgreSQL 16
```

En la instalación Docker, Nginx sirve la versión web en el puerto `8080` y
redirige `/api/*` al backend. FastAPI escucha en `8000` y PostgreSQL en `5433`.
La aplicación móvil se conecta directamente a la dirección configurada en
`EXPO_PUBLIC_API_URL`.

## 3. Flujo funcional de principio a fin

1. El Registrador crea usuarios, cooperativas y vehículos.
2. Al crear un Caficultor se registran departamento, municipio y vereda. El
   caficultor puede guardar las coordenadas exactas de su finca.
3. El Caficultor registra una solicitud con uno o varios grupos de bultos. El
   peso total se calcula con peso por bulto, cantidad y peso adicional.
4. El Coordinador convierte una solicitud activa en recolección, selecciona
   vehículo, conductor y cooperativa y consulta los estados operativos.
5. El Conductor ve sus entregas. En GPS y trayecto, el primer destino es la
   finca del caficultor.
6. Al llegar dentro del radio permitido, confirma que recogió la carga. Desde
   ese momento el destino cambia a la cooperativa.
7. El teléfono registra puntos GPS, distancia, precisión, velocidad y rumbo.
   Los demás usuarios reciben actualizaciones por WebSocket y consultas REST.
8. El Conductor finaliza o cancela la entrega. Cada cambio queda registrado en
   el historial.
9. El Coordinador consulta monitoreo, novedades, historiales y reportes, y
   exporta el resultado a PDF o Excel.
10. Si se pierde la red, el front-end conserva operaciones pendientes y las
    sincroniza al recuperar la conexión.

## 4. Roles y responsabilidades

| Rol | Funcionalidad principal | Importancia |
| --- | --- | --- |
| Registrador | Administra usuarios, cuenta de conductor, cooperativas, ubicación y vehículos. | Mantiene los catálogos y accesos confiables. |
| Caficultor | Guarda la finca, solicita recolección, consulta su actividad y sigue el vehículo. | Origina el proceso logístico y define el punto de recogida. |
| Coordinador | Registra recolecciones, asigna recursos, monitorea operaciones y genera reportes. | Controla la operación y resuelve disponibilidad y trazabilidad. |
| Conductor | Acepta el viaje asignado, navega, confirma carga, transmite GPS y reporta novedades. | Ejecuta el transporte físico y alimenta el seguimiento. |

## 5. Backend

### 5.1 Tecnologías

- Python 3.11.
- FastAPI y Uvicorn para HTTP.
- SQLAlchemy para acceso a datos.
- Alembic para migraciones.
- PostgreSQL 16.
- Argon2id para contraseñas.
- JWT HS256 y sesiones revocables almacenadas en PostgreSQL.
- WebSockets para seguimiento en tiempo real.
- ReportLab y OpenPyXL para PDF y Excel.
- Pytest para pruebas.

### 5.2 Flujo de arranque

`app/main.py` importa todos los modelos, configura observabilidad, CORS,
hosts permitidos y manejadores de error, registra cada router y expone los
health checks. En el `lifespan` crea el primer Registrador si la base todavía
no tiene uno y comienza una tarea que elimina eventos vencidos cada seis horas.

En Docker el orden es:

1. PostgreSQL inicia y ejecuta `BaseDatos.sql` solo si el volumen está vacío.
2. El health check espera que PostgreSQL responda.
3. El backend ejecuta `alembic upgrade head`.
4. Uvicorn inicia `app.main:app` en el puerto `8000`.
5. El front-end web inicia cuando `/health/ready` confirma que la API y la base
   están disponibles.

### 5.3 Capas del backend

| Capa | Carpeta | Responsabilidad | Por qué es importante |
| --- | --- | --- | --- |
| API | `app/api` | Define URL, método, permisos, entrada y respuesta. | Es el contrato consumido por el front-end. |
| Esquemas | `app/schemas` | Valida datos con Pydantic. | Rechaza entradas inválidas antes de tocar la base. |
| Servicios | `app/services` | Aplica reglas de negocio y autorización contextual. | Evita que las reglas queden dispersas en rutas o SQL. |
| Repositorios | `app/repositories` | Ejecuta consultas y escritura SQLAlchemy. | Centraliza el acceso a datos y transacciones. |
| Modelos | `app/models` | Representa tablas y relaciones. | Mantiene sincronizados Python y PostgreSQL. |
| Núcleo | `app/core` | Seguridad, configuración, BD, tiempo real y registros. | Proporciona infraestructura compartida. |

El recorrido normal de una petición es:

```text
petición → autenticación → esquema Pydantic → endpoint
         → servicio → repositorio → SQLAlchemy → PostgreSQL
         → esquema de respuesta → JSON
```

### 5.4 Archivos principales del backend

| Archivo | Función e importancia |
| --- | --- |
| `backend/Dockerfile` | Construye la API con Python 3.11 e instala dependencias reproducibles. |
| `backend/requirements.txt` | Fija versiones de producción; evita diferencias accidentales entre equipos. |
| `backend/requirements-dev.txt` | Agrega Pytest para desarrollo y validación. |
| `backend/.env.example` | Plantilla segura de configuración; no contiene secretos reales. |
| `backend/alembic.ini` | Configura el sistema de migraciones. |
| `backend/BaseDatos.sql` | Crea el esquema inicial, restricciones, índices y roles cuando el volumen está vacío. |
| `backend/app/main.py` | Punto de entrada y composición completa de FastAPI. |
| `backend/app/core/config.py` | Lee y valida entorno, JWT, CORS, hosts, retención y límites del pool. |
| `backend/app/core/database.py` | Crea el motor, pool, sesiones y dependencia `get_db`. |
| `backend/app/core/auth.py` | Crea, valida y revoca sesiones; aplica permisos por rol. |
| `backend/app/core/security.py` | Genera y verifica hashes Argon2id. |
| `backend/app/core/observability.py` | Logs JSON, identificadores de petición, métricas, errores uniformes y limitación de solicitudes. |
| `backend/app/core/realtime.py` | Mantiene las conexiones WebSocket agrupadas por entrega. |
| `backend/app/core/time.py` | Unifica el manejo de fecha y hora UTC. |

Los archivos `__init__.py` declaran paquetes Python y, en `models`, garantizan
que SQLAlchemy conozca todas las entidades y relaciones.

### 5.5 APIs disponibles

Todas las rutas protegidas reciben `Authorization: Bearer <token>`.

#### Sesión y panel

| Método y ruta | Rol | Función |
| --- | --- | --- |
| `POST /login` | Público | Valida credenciales, bloqueo y crea sesión JWT. |
| `GET /me` | Autenticado | Devuelve el perfil actual y permite restaurar sesión. |
| `POST /logout` | Autenticado | Revoca la sesión actual. |
| `GET /dashboard/` | Autenticado | Entrega métricas específicas del rol. |

#### Usuarios y catálogos

| Grupo | Rutas | Acceso e importancia |
| --- | --- | --- |
| Usuarios | `GET/POST /usuarios/`, `GET/PUT/DELETE /usuarios/{id}`, `GET /usuarios/correo/{correo}` | Registrador; administra identidades y perfiles. |
| Estado de cuenta | `GET/PUT /usuarios/{id}/estado` | Registrador; habilita o bloquea acceso. |
| Finca propia | `PUT /usuarios/mi-ubicacion` | Caficultor; guarda el origen GPS de la recolección. |
| Roles | CRUD `/roles` | Registrador; catálogo de permisos. |
| Conductores | CRUD `/conductores` | Registrador; licencia y vínculo uno a uno con usuario. |
| Cooperativas | CRUD `/cooperativas` | Registrador; destino con ubicación geográfica. |
| Vehículos | CRUD `/vehiculos` | Registrador; placa, modelo, capacidad, estado y conductor. |
| Conductores disponibles | `GET /vehiculos/conductores-disponibles` | Registrador; evita asignaciones incompatibles. |
| Estado de flota | `GET /vehiculos/estado` | Registrador y Coordinador; visión operativa. |
| Ubicaciones | CRUD `/ubicaciones` | Coordinador; catálogo geográfico. |
| Rutas | CRUD `/rutas` | Coordinador; recorridos y cooperativa destino. |

La validación de vehículo restringe el modelo a años desde 2000 hasta el año
siguiente al actual, valida placa, capacidad positiva y conductor válido.

#### Carga y solicitud

| Método y ruta | Rol | Función |
| --- | --- | --- |
| `GET /cargas/` y `GET /cargas/{id}` | Coordinador/Caficultor | Consulta cargas autorizadas. |
| `POST /cargas/` | Caficultor | Crea una carga propia. |
| `PUT/DELETE /cargas/{id}` | Coordinador/Caficultor propietario | Modifica o elimina según estado. |
| `GET /solicitudes/` | Coordinador | Lista solicitudes. |
| `GET /solicitudes/mis-solicitudes` | Caficultor | Panel de actividad propia. |
| `GET /solicitudes/mi-seguimiento` | Caficultor | Entrega activa vinculada al usuario. |
| `POST /solicitudes/` | Caficultor | Crea solicitud en línea. |
| `POST /solicitudes/sincronizar` | Caficultor | Inserta una solicitud offline de manera idempotente. |
| `GET/PUT/DELETE /solicitudes/{id}` | Coordinador o propietario según operación | Consulta y mantenimiento controlado. |

`client_request_id` evita duplicar solicitudes cuando un teléfono reintenta una
sincronización. La carga acepta grupos de bultos; el servidor vuelve a calcular
el total y no confía únicamente en el valor presentado por el cliente.

#### Entregas, asignación y seguimiento

| Método y ruta | Rol | Función |
| --- | --- | --- |
| `GET/POST /entregas/` | Coordinador | Lista y registra recolecciones. |
| `GET /entregas/solicitudes-activas` | Coordinador | Fuente del formulario de recolección. |
| `GET /entregas/pendientes-asignacion` | Coordinador | Recolecciones aún sin recursos. |
| `GET /entregas/vehiculos-disponibles` | Coordinador | Capacidad total, ocupada y disponible. |
| `GET /entregas/conductores-disponibles` | Coordinador | Conductores que pueden tomar viaje. |
| `GET /entregas/cooperativas-disponibles` | Coordinador | Posibles destinos finales. |
| `POST /entregas/{id}/asignar-vehiculo` | Coordinador | Asigna vehículo, conductor y cooperativa en transacción. |
| `GET /entregas/historial-asignaciones` | Coordinador | Auditoría de quién asignó cada recurso. |
| `GET /entregas/mis-asignadas` | Conductor | Viajes propios pendientes o activos. |
| `POST /entregas/{id}/confirmar-carga` | Conductor | Confirma recogida cerca de la finca y cambia destino a cooperativa. |
| `PATCH /entregas/{id}/estado` | Conductor asignado | Cambia a pendiente, en camino, entregado o cancelado. |
| `POST /entregas/{id}/ubicacion` | Conductor asignado | Registra un punto GPS idempotente. |
| `POST /entregas/{id}/ubicaciones/sincronizar` | Conductor asignado | Recibe hasta 200 puntos offline. |
| `GET /entregas/{id}/seguimiento` | Coordinador/Conductor/Caficultor relacionado | Devuelve ruta, etapa y destinos permitidos. |
| `GET /entregas/mi-seguimiento` | Caficultor | Obtiene su entrega activa. |
| `GET /entregas/historial` | Coordinador/Caficultor | Filtros y paginación del historial. |
| `GET /entregas/{id}/historial-estados` | Coordinador/Conductor | Auditoría de estados. |
| `GET /entregas/historial-estados/lote` | Coordinador/Conductor | Historial eficiente para varias entregas. |
| `GET/POST /entregas/{id}/eventos-conductor` | Conductor | Consulta o reporta novedades. |
| `GET /entregas/eventos/notificaciones` | Coordinador/Caficultor | Bandeja filtrable de eventos. |
| `DELETE /entregas/eventos/{evento}` | Coordinador | Retira una notificación. |

El backend rechaza coordenadas fuera de rango, puntos demasiado imprecisos,
saltos imposibles, velocidades anómalas, fechas futuras y datos repetidos. Cada
punto lleva `client_point_id`, por lo que reenviar un lote no duplica la ruta.

#### Tiempo real, monitoreo y reportes

| Método y ruta | Rol | Función |
| --- | --- | --- |
| `WS /ws/seguimiento` | Coordinador/Conductor/Caficultor autorizado | Envía snapshot y cambios de una entrega; revalida sesión. |
| `GET /monitoreo/resumen` | Coordinador | Flota activa, GPS actualizado/desactualizado y métricas internas. |
| `GET /reportes/` | Coordinador | Datos de café por caficultor, entregas por vehículo y resumen diario. |
| `GET /reportes/exportar?formato=pdf|excel` | Coordinador | Genera archivo de hasta 5 MB para un período máximo de 30 días. |
| `GET /historial-eventos/*` | Coordinador | CRUD del historial general de eventos. |
| `GET /health/live` | Infraestructura | Confirma que el proceso está vivo. |
| `GET /health/ready` | Infraestructura | Confirma proceso y conexión a PostgreSQL. |

### 5.6 Modelos y tablas

| Modelo/tabla | Contenido | Importancia |
| --- | --- | --- |
| `Rol / rol` | Registrador, Conductor, Coordinador y Caficultor. | Base de autorización. |
| `Usuario / usuario` | Identidad, contacto, contraseña, bloqueo, zona y finca. | Persona autenticada del sistema. |
| `AuthSession / auth_session` | Identificador revocable y vencimiento de JWT. | Permite cerrar o invalidar sesiones. |
| `Conductor / conductor` | Licencia, foto y usuario asociado. | Perfil especializado para transportar. |
| `Ubicacion / ubicacion` | Coordenadas, departamento, ciudad y dirección. | Punto reutilizable de cooperativa/evento. |
| `Cooperativa / cooperativa` | Contacto y ubicación destino. | Lugar final de la carga. |
| `Ruta / ruta` | Descripción, distancia, tiempo y cooperativa. | Plan logístico de referencia. |
| `Vehiculo / vehiculo` | Placa, tipo, modelo, capacidad, estado y conductor. | Recurso físico con límite de carga. |
| `Carga / carga` | Peso, bultos, grupos, caficultor, vehículo y destino. | Café que se transporta. |
| `Solicitud / solicitud` | Petición del caficultor, estado e idempotencia. | Inicio formal del proceso. |
| `Entrega / entrega` | Solicitud, cantidad, estado, recogida y distancia. | Unidad principal de operación y seguimiento. |
| `HistorialAsignacion / historial_asignacion` | Recursos asignados, coordinador y fecha. | Auditoría de asignación. |
| `HistorialEstadoEntrega / historial_estado_entrega` | Estado anterior/nuevo, usuario y hora. | Trazabilidad inmutable de cambios. |
| `SeguimientoUbicacion / seguimiento_ubicacion` | Punto GPS y metadatos de calidad. | Construye ruta y ubicación actual. |
| `HistorialEvento / historial_de_eventos` | Novedad, entrega, conductor, ubicación y expiración. | Comunicación operativa y alertas. |

Los modelos se encuentran en archivos del mismo nombre dentro de
`backend/app/models`. Los esquemas Pydantic equivalentes están en
`backend/app/schemas`. Los repositorios CRUD están en
`backend/app/repositories` y sus reglas están en `backend/app/services`.

### 5.7 Migraciones

| Migración | Finalidad |
| --- | --- |
| `20260829_01_professional_tracking_baseline.py` | Línea base del seguimiento profesional. |
| `20260829_02_distance_travelled.py` | Distancia recorrida acumulada. |
| `20260829_03_schema_integrity.py` | Restricciones e integridad del esquema. |
| `20260902_04_cooperative_management.py` | Administración y ubicación de cooperativas. |
| `20260903_05_event_history_retention.py` | Retención y vencimiento de eventos. |
| `20260907_06_bag_details.py` | Peso por bulto, cantidad y peso adicional. |
| `20260907_07_multiple_bag_groups.py` | Varios grupos de bultos en una carga. |
| `20260907_08_pickup_stage.py` | Confirmación de carga y etapa finca/cooperativa. |

Nunca se deben borrar migraciones que ya se hayan aplicado. `BaseDatos.sql`
sirve para una base nueva y Alembic actualiza bases existentes.

### 5.8 Seguridad y tolerancia a errores

- Contraseñas con Argon2id; nunca se guarda texto plano.
- JWT con emisor, audiencia, vencimiento, `jti` y sesión revocable.
- Bloqueo temporal después de intentos fallidos y estado habilitado/deshabilitado.
- Permisos aplicados en el backend; ocultar botones no sustituye autorización.
- CORS y hosts exactos obligatorios en producción.
- Consultas con timeout, verificación de conexión y pool configurable.
- Errores HTTP, validación, base de datos y fallos inesperados tienen respuesta
  uniforme con `X-Request-ID`.
- Logs JSON facilitan diagnóstico en Docker o un agregador externo.
- Health checks separan proceso vivo de servicio listo.
- Eventos temporales se eliminan según `EVENT_RETENTION_DAYS`.
- Sincronización GPS y solicitudes usa identificadores idempotentes.

## 6. Front-end

### 6.1 Tecnologías y plataformas

- React 19 y React Native 0.86.
- Expo SDK 57.
- React Native Web para navegador.
- Expo Location y Task Manager para GPS móvil.
- Expo SQLite para cola offline nativa.
- Expo Secure Store para sesión móvil.
- Leaflet para mapas web y React Native Maps para mapas móviles.
- NetInfo para detectar conectividad.
- Jest Expo para pruebas.

### 6.2 Arranque y composición

`index.js` carga primero los estilos globales y registra la tarea GPS antes de
montar React. Luego registra `AplicacionPrincipal.jsx` con Expo.

`AplicacionPrincipal.jsx`:

- restaura una sesión guardada;
- valida la sesión con `/me` cuando hay red;
- mantiene datos locales si el servidor no responde;
- selecciona la pantalla activa;
- observa conexión y sincronización;
- cierra sesión local y remotamente;
- presenta errores y estado de red sin bloquear toda la pantalla.

No se usa una librería de navegación: el estado `screen` selecciona el módulo
registrado. `configuracion/navegacion.js` define las pantallas permitidas por
rol y las pruebas verifican que todos los destinos existan.

### 6.3 Archivos de entrada y despliegue

| Archivo | Función e importancia |
| --- | --- |
| `frontend/App.js` | Entrada de compatibilidad para herramientas que esperan `App.js`. |
| `frontend/index.js` | Registra tarea GPS, aplicación y filtros de avisos de desarrollo. |
| `frontend/app.json` | Identidad, permisos, iconos y plugins Expo. |
| `frontend/app.config.js` | Inyecta Google Maps solo si existe una clave y comunica su disponibilidad. |
| `frontend/eas.json` | Perfiles de APK de desarrollo, vista previa y producción. |
| `frontend/package.json` | Dependencias y comandos npm. |
| `frontend/package-lock.json` | Instalación reproducible exacta. |
| `frontend/Dockerfile` | Exporta web con Node 22 y la sirve mediante Nginx. |
| `frontend/nginx.conf` | SPA, proxy `/api`, WebSocket y health check. |
| `frontend/.env.example` | Variables públicas esperadas por Expo. |
| `frontend/ESTRUCTURA_FRONTEND.md` | Guía corta para ubicar código nuevo. |

### 6.4 Módulos visuales

| Archivo | Función | Importancia |
| --- | --- | --- |
| `aplicacion/AplicacionPrincipal.jsx` | Sesión, navegación, red y composición. | Centro del front-end. |
| `autenticacion/IniciarSesion.jsx` | Formulario y llamada de acceso. | Puerta de entrada segura. |
| `panel/PanelPorRol.jsx` | Métricas, accesos y caché del panel. | Inicio operativo adaptado al rol. |
| `usuarios/GestionUsuarios.jsx` | CRUD, estado de cuenta, perfil conductor y filtros con conteo por rol. | Administración integral del personal. |
| `cooperativas/GestionCooperativas.jsx` | CRUD, GPS actual, geocodificación inversa y selección manual en mapa. | Garantiza un destino geográfico válido. |
| `vehiculos/GestionVehiculos.jsx` | CRUD, año mínimo 2000, capacidad, placa y conductor. | Mantiene la flota. |
| `vehiculos/EstadoVehiculos.jsx` | Estado y mapa de la flota. | Visibilidad operacional. |
| `vehiculos/AsignacionVehiculos.jsx` | Selecciona entrega, vehículo, conductor y cooperativa. | Une recursos antes del viaje. |
| `caficultor/UbicacionFinca.native.jsx` | Captura GPS de finca en móvil. | Define el primer destino real. |
| `caficultor/UbicacionFinca.web.jsx` | Registro equivalente desde web. | Compatibilidad de plataforma. |
| `caficultor/SolicitarRecoleccion.jsx` | Grupos de bultos y envío offline-first. | Crea la demanda logística. |
| `caficultor/MiActividad.jsx` | Solicitudes y entregas propias. | Seguimiento del caficultor. |
| `entregas/RegistrarRecoleccionCafe.jsx` | Convierte solicitud activa en entrega. | Flujo principal del Coordinador. |
| `entregas/EntregasAsignadas.jsx` | Lista los viajes del Conductor. | Permite escoger la carga a transportar. |
| `entregas/HistorialEntregas.jsx` | Filtros y paginación histórica. | Consulta y auditoría. |
| `entregas/HistorialAsignaciones.jsx` | Quién asignó cada recurso. | Responsabilidad operacional. |
| `seguimiento/SeguimientoVehiculo.native.jsx` | GPS, ruta vial, recogida, cooperativa, offline y estados. | Núcleo móvil del transporte. |
| `seguimiento/SeguimientoVehiculo.web.jsx` | Seguimiento y mapa en navegador. | Supervisión y compatibilidad web. |
| `seguimiento/MonitoreoOperativo.jsx` | Salud GPS y vehículos activos. | Detecta teléfonos sin actualizar. |
| `reportes/Reportes.jsx` | Consulta y descarga PDF/Excel en web o móvil. | Evidencia y análisis de operación. |

### 6.5 Componentes reutilizables

| Archivo | Función e importancia |
| --- | --- |
| `comunes/CampoFormulario.jsx` | Campo etiquetado uniforme. |
| `comunes/Encabezado.jsx` | Marca, usuario, configuración y salida. |
| `comunes/MensajeRetroalimentacion.jsx` | Aviso compacto, temporal y descartable. |
| `comunes/LimiteErrorAplicacion.jsx` | Captura errores React y permite volver al panel. |
| `entregas/BandejaMensajesEventos.jsx` | Novedades filtradas para Coordinador/Caficultor. |
| `entregas/ReportadorNovedadConductor.jsx` | Registra retraso, daño, parada, llegada u otro evento. |
| `mapas/MapaFlota.native.jsx` y `.web.jsx` | Mapa de vehículos por plataforma. |
| `mapas/MapaSeguimiento.web.jsx` | Ruta y destinos de una entrega en navegador. |
| `mapas/MarcadorVehiculo.native.jsx` | Marcador animado del vehículo. |
| `mapas/SelectorUbicacionCooperativa.native.jsx` y `.web.jsx` | Selección manual de cooperativa. |
| `mapas/VistaPreviaRuta.native.jsx` | Alternativa visual si el mapa nativo no está disponible. |

Los sufijos `.native` y `.web` permiten que React Native elija automáticamente
la implementación correcta sin condicionales extensos.

### 6.6 Configuración, estilos y lógica no visual

| Archivo o grupo | Responsabilidad |
| --- | --- |
| `configuracion/ClienteApi.js` | Resuelve URL local/LAN, agrega timeout, normaliza fallos y notifica sesión vencida. |
| `configuracion/index.js` | Punto único de exportación del cliente API. |
| `configuracion/navegacion.js` | Pantallas y accesos por rol. |
| `configuracion/disponibilidadMapa.js` | Decide si el mapa nativo puede montarse. |
| `configuracion/mapasNativos.js` | Detecta Expo Go y clave de Google Maps. |
| `ganchos/usarSondeo.js` | Ejecuta una carga inicial y sondeo periódico seguro. |
| `utilidades/calculosRuta.js` | Muestrea, proyecta y dibuja coordenadas. |
| `estilos/colores.js` | Paleta central. |
| `estilos/secciones/estructura.js` | Página, encabezado, cuadrículas y contenedores. |
| `estilos/secciones/formularios.js` | Campos, botones y selectores. |
| `estilos/secciones/tarjetas.js` | Tarjetas, métricas y filtros. |
| `estilos/secciones/operacion.js` | GPS, mapas, seguimiento y estados. |
| `estilos/index.js` | Combina los estilos React Native. |
| `estilos/web.css` | Reglas globales exclusivas del navegador. |
| `estilos/global.native.js` y `.web.js` | Entrada de estilos por plataforma. |

### 6.7 Servicios del front-end

| Servicio | Responsabilidad e importancia |
| --- | --- |
| `calidadGps.js` | Distancia Haversine y rechazo de lecturas imprecisas o imposibles. |
| `cifradoSinConexion.native.js` | Cifra texto sensible almacenado localmente. |
| `estadoCuenta.js` | Presenta habilitación, bloqueo temporal e intentos. |
| `historialEntregas.js` | Obtiene historiales por lotes con control de errores. |
| `politicaContrasena.js` | Regla y ayuda de contraseña compartida. |
| `politicaSegundoPlano.js` | Ajusta frecuencia GPS según batería y ahorro de energía. |
| `politicaSincronizacion.js` | Reintentos exponenciales y clasificación de fallos. |
| `presentacionCarga.js` | Cálculo y formato de bultos, kilogramos y toneladas. |
| `presentacionConexion.js` | Etiquetas comprensibles de red y sincronización. |
| `presentacionSeguimiento.js` | Etiquetas de WebSocket y modo GPS. |
| `propietarioSinConexion.js` | Aísla datos offline por usuario. |
| `seguimientoTiempoReal.js` | Construye URL WebSocket, reconecta y fusiona puntos. |
| `sesionSeguimiento.native.js` | Sesión y entrega activa en Secure Store. |
| `sesionSeguimiento.web.js` | Sesión web mantenida en memoria para reducir exposición. |
| `sinConexion.native.js` | Cola SQLite, caché, cifrado, sincronización y rechazados. |
| `sinConexion.web.js` | Cola y caché equivalente en almacenamiento del navegador. |
| `ubicacionSegundoPlano.native.js` | Tarea GPS con Expo Location y Task Manager. |
| `ubicacionSegundoPlano.web.js` | Implementación segura sin segundo plano para navegador. |

### 6.8 Funcionamiento sin conexión

En móvil se crea `coffee-fly-offline.db` con:

- `sync_queue`: operaciones pendientes y número de intentos;
- `sync_rejected`: fallos definitivos conservados para diagnóstico;
- `sync_state`: cachés, última sincronización y estado del rastreo.

La cola admite solicitud, ubicación de finca y ubicación GPS. Cada elemento
pertenece al usuario autenticado. Al volver la red, procesa por orden, envía
lotes GPS, reconoce duplicados, reintenta fallos temporales con espera creciente
y separa errores permanentes. Un cierre de la aplicación no borra la cola.

En web se usa almacenamiento del navegador para operaciones y cachés. El token
no se persiste en `localStorage`; al recargar se solicita iniciar sesión otra
vez, reduciendo el riesgo de robo por scripts inyectados.

### 6.9 GPS y cambio de destino

El conductor debe tener una entrega asignada. El sistema obtiene primero la
ubicación de la finca. El botón de confirmación solo se habilita cuando la
ubicación del teléfono está dentro del radio indicado por el backend, actualmente
250 metros. Tras confirmar carga, el backend guarda `carga_recogida_en` y devuelve
`etapa_viaje = hacia_cooperativa`. La ruta se recalcula hacia la cooperativa.

Expo Go sirve para pruebas de primer plano. El seguimiento real con pantalla
apagada necesita un development build o APK con permisos de segundo plano.

## 7. Cómo ejecutar todo

### 7.1 Opción recomendada: Docker

Requisitos: Docker Desktop activo y puertos `8080`, `8000` y `5433` libres.

Desde la raíz del proyecto:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

Direcciones:

- Aplicación web: `http://localhost:8080`
- API: `http://localhost:8000`
- Swagger en desarrollo: `http://localhost:8000/docs`
- Salud del backend: `http://localhost:8000/health/ready`
- Salud a través del front-end: `http://localhost:8080/health`

Logs:

```powershell
docker compose logs -f backend frontend db
```

Reiniciar un servicio:

```powershell
docker compose restart backend
docker compose restart frontend
```

Detener sin borrar datos:

```powershell
docker compose down
```

No use `docker compose down -v` salvo que quiera eliminar definitivamente la
base local, porque `-v` borra el volumen `postgres_data`.

### 7.2 Backend sin Docker

Se necesita Python 3.11 y PostgreSQL accesible en `5433`.

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
Copy-Item .env.example .env
alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Antes de iniciar, ajuste `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS` y
`ALLOWED_HOSTS` en `backend/.env`.

### 7.3 Front-end móvil con Expo Go

Expo SDK 57 requiere Node.js 22.13 o posterior. El celular y el computador deben
estar en la misma red.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npx expo start --go --clear --lan
```

Escanee el QR con Expo Go. Para un celular físico, no use `localhost` como URL
de la API: use la IPv4 del computador, por ejemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
```

Si el teléfono no puede alcanzar la red local, use el script de túnel descrito
en `frontend/README.md` y una URL HTTPS pública para la API.

### 7.4 Front-end web sin Docker

```powershell
cd frontend
npm ci
$env:EXPO_PUBLIC_API_URL='http://localhost:8000'
npm run web
```

Expo mostrará la URL local. El backend debe aceptar ese origen en
`CORS_ORIGINS`.

### 7.5 Development build y producción móvil

```powershell
cd frontend
npx eas build --profile development --platform android
npx eas build --profile preview --platform android
npx eas build --profile production --platform android
```

Para Google Maps nativo configure `GOOGLE_MAPS_ANDROID_API_KEY` como secreto del
entorno de compilación. No confirme la clave en Git. Los permisos de ubicación
en segundo plano deben probarse en un development build o APK, no únicamente en
Expo Go.

## 8. Variables de entorno

### 8.1 Backend

| Variable | Propósito |
| --- | --- |
| `ENV` | `development` o `production`; desactiva Swagger en producción. |
| `DATABASE_URL` | Conexión PostgreSQL obligatoria. |
| `JWT_SECRET_KEY` | Firma de tokens; obligatoria y secreta en producción. |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Identidad esperada del token. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración de sesión entre 5 y 1440 minutos. |
| `CORS_ORIGINS` | Orígenes web permitidos separados por coma. |
| `ALLOWED_HOSTS` | Hosts HTTP permitidos. |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` | Capacidad del pool. |
| `DB_POOL_TIMEOUT_SECONDS` | Espera máxima por conexión. |
| `DB_STATEMENT_TIMEOUT_MS` | Tiempo máximo de una sentencia PostgreSQL. |
| `DB_CONNECT_TIMEOUT_SECONDS` | Tiempo máximo para conectar. |
| `EVENT_RETENTION_DAYS` | Días que vive una novedad. |
| `BOOTSTRAP_REGISTRADOR_*` | Crea el primer Registrador solo si aún no existe. |

En Docker también se usan `POSTGRES_PASSWORD`, `POSTGRES_HOST_PORT`,
`BACKEND_HOST_PORT` y `FRONTEND_HOST_PORT`.

### 8.2 Front-end

| Variable | Propósito |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base REST; `/api` en Docker web o URL absoluta en móvil. |
| `EXPO_PUBLIC_REVERSE_GEOCODING_URL` | Servicio opcional de geocodificación inversa. |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Clave privada usada al compilar Android. |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | Alternativa pública; se recomienda la variable privada anterior. |

Las variables `EXPO_PUBLIC_*` quedan incluidas en el bundle y nunca deben
contener contraseñas o secretos.

## 9. Pruebas y verificaciones

Backend:

```powershell
cd backend
pytest -q
```

Los archivos `test_*.py` validan seguridad, esquemas, GPS, tiempo real,
observabilidad, bultos, historial y etapa de recogida. Los archivos
`integration_*_live.py` requieren servicios reales y verifican seguridad,
rendimiento, WebSocket, monitoreo y cargas. `physical_gps_monitor.py` ayuda en
pruebas con un teléfono físico.

Front-end:

```powershell
cd frontend
npm test -- --runInBand
npx expo-doctor@latest
npx expo export --platform web
npx expo export --platform android
```

Las pruebas cubren cliente API, contraseñas, conexión, sincronización, cifrado,
propiedad offline, GPS, mapas, navegación, historial, presentación y WebSocket.

## 10. Diagnóstico rápido

| Síntoma | Comprobación | Solución habitual |
| --- | --- | --- |
| El móvil no conecta | Abra `/health/ready` desde el navegador del celular. | Corrija IPv4, firewall o `EXPO_PUBLIC_API_URL`. |
| Expo Go dice SDK incompatible | Compare Expo Go y `expo` de `package.json`. | Use Expo Go para SDK 57 o genere development build. |
| Sesión vence al reiniciar | Falta clave estable en desarrollo. | Configure `JWT_SECRET_KEY`. |
| Web recibe CORS | Revise origen exacto. | Agréguelo a `CORS_ORIGINS` y reinicie backend. |
| Base no está lista | `docker compose ps` y logs de `db`. | Corrija contraseña/puerto y espere health check. |
| Migración falla | `alembic current` y `alembic heads`. | No edite una migración aplicada; cree una nueva corrección. |
| No aparece mapa nativo | Falta clave o se ejecuta en Expo Go. | Configure Google Maps o use la vista previa segura. |
| GPS no funciona en segundo plano | Expo Go limita tareas nativas. | Use development build/APK y conceda permisos. |
| Datos pendientes | Revise banner de sincronización y red. | Mantenga sesión abierta y pulse actualizar al recuperar conexión. |
| Exportación falla | Período o conectividad. | Use máximo 30 días, revise sesión y health check. |

## 11. Elementos que no se deben eliminar

- `package-lock.json`: garantiza las mismas versiones del front-end.
- migraciones de Alembic: necesarias para actualizar instalaciones existentes.
- pruebas: detectan regresiones aunque no participen en producción.
- archivos `.native` y `.web`: React Native selecciona uno según plataforma.
- `BaseDatos.sql`: inicializa bases nuevas en Docker.
- `.env.example`: documenta configuración sin exponer secretos.
- `Dockerfile`, `nginx.conf` y `docker-compose.yml`: ejecución reproducible.
- carpetas `assets`: contienen iconos, splash, favicon y marca usados en bundle.

Sí se pueden borrar cuando Metro, Pytest o una exportación no estén ejecutándose:
`__pycache__`, `.pytest_cache`, `.expo`, carpetas `.verification-*`, `dist` y
`node_modules`. Todas son regenerables; `node_modules` vuelve con `npm ci`.

## 12. Mantenimiento recomendado

1. Cambiar primero el esquema con una migración nueva.
2. Actualizar modelo, esquema, repositorio, servicio y API en ese orden.
3. Ajustar el cliente y la pantalla correspondiente.
4. Añadir pruebas del backend y del front-end.
5. Ejecutar Pytest, Jest, Expo Doctor y exportación web/Android.
6. Probar con pérdida y recuperación de red.
7. Probar permisos y GPS en dispositivo físico antes de publicar.
8. En producción usar HTTPS, secretos externos, CORS/hosts exactos, copias de
   PostgreSQL y monitoreo de logs y health checks.

Esta separación evita que una pantalla decida reglas críticas, que una API
contenga SQL disperso o que un cambio de plataforma rompa todo el front-end.
