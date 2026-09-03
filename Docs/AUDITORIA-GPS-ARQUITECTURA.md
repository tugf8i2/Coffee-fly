# Auditoría técnica de GPS, modo offline y arquitectura

Fecha de revisión: 29 de agosto de 2026.

## Resultado ejecutivo

Coffee Fly conserva los módulos funcionales RF-01 a RF-17 en una sola entrada canónica (`frontend/src/FullApp.js`). La aplicación usa Expo/React Native para Android, iOS y web, FastAPI para REST y WebSockets, PostgreSQL para persistencia y SQLite cifrado en el dispositivo para la operación offline móvil.

La solución ya incluye calidad GPS, cola idempotente, sincronización por lotes, reintentos exponenciales, seguimiento incremental, control de acceso por rol, sesiones revocables, bloqueo de cuentas, observabilidad y migraciones Alembic. Ningún software puede garantizar seguimiento en segundo plano al 100 %: Android/iOS, el fabricante, el usuario o el cierre forzado pueden suspender el proceso.

## Arquitectura efectiva

```text
GPS del dispositivo
  -> validación de calidad y frecuencia adaptativa
  -> SQLite cifrado AES-256-GCM
  -> sincronización REST por lotes e idempotencia
  -> FastAPI (API -> servicio -> repositorio)
  -> transacción PostgreSQL
  -> publicación WebSocket
  -> mapa incremental del trayecto + mapa agregado de flota
```

Componentes principales:

- `frontend/src/FullApp.js`: sesión, navegación completa y sincronización.
- `frontend/src/services/backgroundLocation.native.js`: captura foreground/background.
- `frontend/src/services/offline.native.js`: SQLite, cola, reintentos y migración cifrada.
- `frontend/src/services/gpsQuality.js`: precisión, distancia, velocidad y tiempo.
- `frontend/src/components/TrackingMap.web.js`: mapa web incremental.
- `frontend/src/components/FleetMap.native.js` y `.web.js`: mapa agregado de todos los vehículos en camino.
- `backend/app/services/entrega_services.py`: reglas GPS, lotes y transacciones.
- `backend/app/repositories/entrega_repositories.py`: bloqueos de fila y consultas agregadas.
- `backend/app/core/realtime.py`: conexiones WebSocket del proceso.
- `backend/app/core/observability.py`: request ID, logs, límites y métricas.
- `backend/app/api/monitoring_api.py`: resumen operativo para coordinadores.

## Incidentes reales encontrados y corregidos

1. **Cierre de Android al crear el mapa.** `react-native-maps` inicializaba Google
   Maps aunque las teselas visibles fueran de OpenStreetMap, pero el APK no tenía
   una clave de Maps SDK for Android. El impacto era el cierre completo de la
   pantalla de seguimiento. `app.config.js` prepara la clave de compilación y las
   pantallas nativas ahora evitan montar el componente sin esa capacidad. GPS,
   cola y ruta siguen operativos; mostrar el mapa nativo requiere un APK nuevo
   compilado con `GOOGLE_MAPS_ANDROID_API_KEY`.
2. **Estado de red engañoso.** Tener Wi-Fi podía mostrar “Sincronizado” aunque
   FastAPI estuviera caído. La comprobación ahora distingue Internet, API no
   disponible, datos pendientes y sincronización; además reintenta cada minuto.
3. **Reinicio GPS bloqueado por un punto repetido.** Una lectura válida omitida
   para evitar duplicados podía impedir reactivar el servicio. Ahora sólo una
   lectura inválida bloquea el inicio; un punto repetido no vuelve a guardarse,
   pero sí permite iniciar el seguimiento.
4. **Backend Docker detenido.** La imagen no declaraba `email-validator`, usado
   por `EmailStr`, y terminaba al importar los esquemas. La dependencia quedó
   fijada y la imagen reconstruida respondió `ready/ok`.
5. **N+1 de historial en el cliente.** Dos módulos solicitaban una petición por
   entrega cada cinco segundos. Se añadió un endpoint por lote, polling no
   solapado que se pausa al minimizar la interfaz y frecuencias de 15–30 segundos.

## GPS móvil

Cada punto puede incluir UUID del cliente, latitud, longitud, precisión, velocidad, rumbo y fecha de captura. Antes de guardar o enviar se aplican validaciones de rango, precisión y coherencia temporal/espacial. Los duplicados se reconocen por UUID y no vuelven a incrementar distancia.

La frecuencia se adapta a batería y movimiento. El seguimiento foreground usa intervalos menos agresivos cuando la batería está baja. En una compilación nativa, Android puede usar una notificación de servicio foreground y solicitar ubicación en segundo plano.

### Limitaciones físicas y del sistema operativo

- Expo Go permite probar interfaces, ubicación en primer plano, API y modo offline, pero no garantiza la tarea real de ubicación en segundo plano. Para esa prueba se necesita un development build o APK nativo.
- Android 11 o superior abre Ajustes para “Permitir siempre”; la aplicación explica el motivo antes de abrirlos.
- Si el usuario pulsa “Forzar detención”, revoca el permiso, desactiva GPS o reinicia el equipo, el sistema puede dejar de entregar ubicaciones.
- Algunos fabricantes aplican ahorro de batería más estricto. Es necesario excluir Coffee Fly de la optimización de batería para pruebas operativas prolongadas.
- En iOS, el usuario puede cambiar precisión exacta por aproximada y el sistema decide cuándo suspender o terminar procesos.
- No hay transmisión en tiempo real sin red. Los puntos se conservan localmente y se sincronizan al recuperar conexión.

Documentación oficial de referencia:

- [Expo Location SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/location/)
- [Expo Battery SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/battery/)
- [Expo SecureStore SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/)

## Offline First y consistencia

La cola móvil guarda primero y sincroniza después. Solicitudes y puntos GPS usan claves idempotentes; repetir un envío no duplica registros. Los puntos GPS se envían en lotes de hasta 100 elementos.

Política de errores:

| Condición | Acción |
|---|---|
| Sin red, timeout, 408, 425, 429 o 5xx | Conservar y reintentar con espera exponencial |
| 401 | Pausar y pedir autenticación; no perder la cola |
| 409 | Resolver como conflicto conocido |
| 400, 403, 404, 405, 410, 413, 415 o 422 | Mover a rechazados con motivo; no hacer bucle infinito |
| Payload local corrupto | Aislar en rechazados sin detener el resto de la cola |

El contenido sensible móvil se cifra con AES-256-GCM. La clave aleatoria de 256 bits se guarda en SecureStore con acceso después del primer desbloqueo, necesario para poder procesar GPS con la pantalla bloqueada. Los registros antiguos en texto plano se migran gradualmente al leerlos.

Si la aplicación se desinstala o la clave de SecureStore se pierde durante una restauración, el cifrado cumple su objetivo de hacer ilegible la base local, pero esos registros no pueden recuperarse. La aplicación debe volver a iniciar sesión y los registros cifrados imposibles de abrir se aíslan para diagnóstico.

La implementación web usa almacenamiento del navegador y no ofrece la misma garantía criptográfica que SecureStore. No se debe considerar el navegador un almacén prolongado de datos sensibles.

## Backend, base de datos y concurrencia

- Operaciones de asignación, cambio de estado y escritura GPS usan transacciones.
- Los recursos críticos se leen con `SELECT FOR UPDATE` para impedir carreras entre coordinadores/conductores.
- Las listas de vehículos disponibles y usuarios usan carga conjunta/agregada, evitando N+1 tanto en SQLAlchemy como en el cliente.
- Hay índices por entrega/fecha, vehículo, identificadores idempotentes y restricciones de unicidad.
- Alembic es la fuente de evolución del esquema; `python -m alembic check` debe quedar limpio.
- El pool de conexiones tiene límites, reciclado, `pre_ping`, timeout de conexión y timeout de sentencias.

### Decisión sobre PostGIS

PostGIS no es una dependencia actual. Para un trayecto individual, Haversine incremental y columnas indexadas son suficientes y reducen complejidad operativa. Debe incorporarse cuando existan búsquedas frecuentes de vehículos cercanos, geocercas, intersecciones, agregaciones espaciales o millones de puntos. En ese caso se recomienda `geography(Point, 4326)` y un índice GiST, con migración y pruebas de planes de consulta.

## Tiempo real y escalamiento

WebSocket fue elegido para actualizaciones incrementales de baja latencia. Al abrir seguimiento, el cliente recibe un snapshot REST/WebSocket y luego sólo los puntos nuevos. Si el socket cae, el cliente reconecta y conserva el snapshot/polling como recuperación.

Para la visión de flota, el coordinador recibe en una sola consulta la última posición, precisión, velocidad, rumbo y vigencia de todos los vehículos en camino. El mapa conserva sus marcadores y sólo actualiza los modificados cada 15 segundos; al abrir el detalle de un vehículo se usa WebSocket. Esta combinación evita abrir un socket por cada vehículo y mantiene baja la carga. Si la flota crece hasta cientos o miles de marcadores simultáneos, se debe incorporar clustering en el cliente y teselas/vectorización en el servidor.

El gestor WebSocket actual vive en memoria de un proceso. Una producción con varios workers o réplicas necesita Redis Pub/Sub, PostgreSQL `LISTEN/NOTIFY` u otro bus compartido. Sin ese bus, un punto recibido por un worker no llegará a un socket conectado a otro.

## Seguridad

- Contraseñas con Argon2id y rehash automático cuando cambian los parámetros.
- JWT HS256 firmado con `jti`; cada sesión existe en PostgreSQL y puede revocarse al cerrar sesión o deshabilitar el usuario.
- Autorización por rol en endpoints y WebSocket.
- Bloqueo temporal de cuenta persistente después de intentos fallidos.
- Límites de solicitudes y cabeceras de seguridad; HSTS sólo en producción HTTPS.
- CORS y hosts exactos en producción. El comodín `trycloudflare.com` sólo se permite en desarrollo.
- No se registran contraseñas ni coordenadas completas en los logs de rechazo GPS.

El limitador por IP incluido es local al proceso. En producción debe complementarse con Cloudflare, un gateway o Redis para compartir límites entre réplicas.

### Auditoría de dependencias

- `pip-audit` no reporta vulnerabilidades conocidas después de actualizar `python-dotenv` a 1.2.2 y `python-multipart` a 0.0.31.
- `pip check` no reporta dependencias Python rotas.
- `npm audit` conserva 8 avisos altos en Metro/image-size, dentro de las herramientas de compilación de Expo SDK 54. No son imports directos del código de negocio.
- Se probó Metro 0.83.8, versión donde el aviso está corregido: Android/web compilaron, pero el servidor Expo SDK 54 falló con `eventsQueue is not iterable`. El override fue revertido porque una mitigación incompatible no es aceptable.
- No debe ejecutarse `npm audit fix --force`: instalaría Expo 57 como cambio mayor. La corrección definitiva es migrar el SDK y generar un development build después de completar la validación física de la versión actual.
- Los `.env` reales están ignorados por Git y la búsqueda de secretos versionados no encontró credenciales incrustadas.

## Monitoreo y diagnóstico

Endpoints:

- `GET /health/live`: proceso vivo.
- `GET /health/ready`: proceso y PostgreSQL listos.
- `GET /monitoreo/resumen`: sólo coordinador; mapa de flota con última coordenada/velocidad/precisión, GPS actualizado, atrasado o ausente y contadores del proceso.

La app muestra ese resumen en **Panel del coordinador -> Monitoreo operativo**. Los logs son JSON e incluyen `request_id`; eventos asociados pueden incluir `delivery_id`, `client_point_id` y motivo sin exponer la coordenada.

Los contadores en memoria se reinician al reiniciar el proceso y no se agregan entre réplicas. Para producción se recomienda exportarlos a Prometheus/OpenTelemetry y crear alertas por:

- crecimiento de `gps_points_rejected`;
- vehículos sin GPS durante más de dos minutos;
- respuestas 5xx;
- errores de PostgreSQL;
- tasa anormal de bloqueos de login.

## Matriz obligatoria de prueba física

| Caso | Acción | Resultado esperado |
|---|---|---|
| GPS activado | Iniciar entrega y moverse | Puntos válidos y ruta incremental |
| GPS desactivado | Desactivar ubicación | Mensaje claro, sin cierre de la app |
| Permiso denegado | Rechazar permiso | Explicación y opción de continuar sólo foreground |
| Mala precisión | Simular/interior con >150 m | Punto rechazado con motivo, sin contaminar distancia |
| Sin señal móvil | Desactivar Wi-Fi/datos | La cola aumenta y la app sigue operando |
| Red intermitente | Alternar conectividad | Reintento sin duplicados |
| API caída | Apagar FastAPI | Datos en cola; ninguna pérdida local |
| Timeout/5xx/429 | Inyectar error | Espera exponencial y posterior recuperación |
| App minimizada | Usar development build | Notificación Android y captura según restricciones del SO |
| Pantalla apagada | Caminar/conducir con build nativo | Puntos recibidos mientras el SO mantenga el servicio |
| Forzar detención | Detener desde Ajustes | Se documenta la interrupción; debe reabrirse manualmente |
| Reinicio del teléfono | Reiniciar y abrir app | Sesión/cola recuperable según SecureStore; reiniciar tracking manualmente si el SO no lo restaura |
| Cola de 8 horas | Recorrido controlado | Sin superar 50 MB y sincronización posterior |

Las pruebas de pantalla apagada, minimización prolongada, fabricantes específicos y 8 horas no pueden certificarse desde este PC sin un teléfono conectado y una build nativa. Deben firmarse en una hoja de prueba con modelo, versión Android/iOS, permisos, ahorro de batería, hora inicial/final, puntos esperados/recibidos y consumo de batería.

La hoja preparada para registrar esa evidencia está en `Docs/PRUEBAS-FISICAS-GPS.md`.

## Evidencia automatizada ejecutada

Resultado de la última revisión local:

- Frontend: 44 pruebas aprobadas en 12 suites, incluida la cobertura de navegación, mapa seguro, vista previa de rutas, estados de conexión, reinicio GPS y consulta de historial por lote.
- Backend: 24 pruebas aprobadas, incluidas las fronteras de GPS actualizado/desactualizado/sin ubicación y el historial por lote.
- Expo Doctor: 18/18 comprobaciones aprobadas.
- Android y web: exportaciones completas sin errores de código.
- Alembic: `No new upgrade operations detected`.
- Seguridad viva: JWT, rutas protegidas, aislamiento entre caficultores, idempotencia y listado de usuarios sin contraseña ni peticiones N+1 aprobados.
- Monitoreo vivo: mapa de flota, coordenada/velocidad/precisión, estados sin GPS/actualizado y punto rechazado visibles.
- Tiempo real vivo: snapshot, lote incremental WebSocket y distancia aprobados.
- Rendimiento vivo: 200 puntos GPS en aproximadamente 0,52 s; lectura de seguimiento en aproximadamente 16,5 ms; listados de vehículos, usuarios y mapa de flota en una sola consulta SQL cada uno, sin N+1.
- API pública y PostgreSQL: `/health/ready` responde `ready/ok`.
- Manifiesto y bundle Android por túnel: HTTP 200, URL pública correcta y módulos completos incluidos.
- Docker: backend y frontend reconstruidos; FastAPI en contenedor respondió `ready/ok` y la web respondió HTTP 200.

### Evidencia física preliminar en Android

El development APK inició sesión contra la API pública, abrió WebSocket y envió
4 puntos GPS únicos y cronológicamente ordenados. La precisión registrada estuvo
entre 9,1 y 33,6 m y el servidor calculó 54,7 m de recorrido sin duplicados. Esta
evidencia valida el recorrido mínimo dispositivo → cola → API → PostgreSQL, pero
no sustituye F-01 (10 minutos) ni certifica pantalla apagada: una observación de
10 minutos sin una acción confirmada sobre el teléfono no produjo nuevos puntos
y se mantiene como **inconclusa**, no como aprobada ni fallida.

El APK usado para esta evidencia queda preservado en
`artifacts/Coffee-Fly-development.apk`. Desde esta revisión el flujo activo de
desarrollo y validación es **web + Expo Go**; no se requieren nuevas compilaciones
APK para continuar trabajando en interfaz, API, ubicación en primer plano, modo
offline y sincronización.

## Comandos de verificación

Backend:

```powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m alembic check
python -m pytest -q
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend
npm ci
npm test -- --runInBand
npx expo-doctor
npx expo export --platform android
npx expo export --platform web
```

Pruebas vivas locales, con FastAPI y PostgreSQL activos:

```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
python tests/integration_monitoring_live.py
python tests/integration_realtime_live.py
python tests/integration_performance_live.py
python tests/integration_security_live.py
```

## Expo Go por túnel

Metro (`8081`) y FastAPI (`8000`) requieren túneles diferentes. El túnel Expo no publica el backend.

```powershell
# Terminal 1: backend
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: API pública de desarrollo
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000

# Copiar la URL HTTPS anterior en frontend/.env y reiniciar Metro
cd frontend
npx expo start --tunnel --go --clear
```

Las URLs `trycloudflare.com` y `exp.direct` son temporales y no tienen garantía de disponibilidad. Para producción se requiere un dominio/túnel estable y secretos de producción.

## Riesgos restantes y siguiente evolución

1. El flujo actual web + Expo Go no certifica ubicación nativa prolongada en segundo plano; completar la matriz física sólo si ese requisito vuelve a activarse.
2. El APK queda archivado. Configurar una clave restringida de Maps SDK for Android y generar otro APK únicamente si el mapa nativo integrado vuelve a ser requisito de aceptación.
3. Mantener SDK 54 mientras el requisito sea Expo Go de tienda; planear su migración como cambio controlado cuando corresponda.
4. Llevar métricas y rate limiting a infraestructura compartida antes de usar varios workers.
5. Añadir PostGIS únicamente cuando las consultas espaciales lo justifiquen.
6. Ejecutar pruebas de carga multiusuario con datos semejantes a producción y monitorear PostgreSQL.
