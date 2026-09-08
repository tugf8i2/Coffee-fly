# Coffee Fly: documentación completa de `frontend/src`

## 1. Alcance

Esta guía documenta los 68 archivos activos dentro de `frontend/src`:

- 33 componentes React `.jsx`.
- 33 archivos `.js` de configuración, servicios, estilos, hooks y utilidades.
- 1 hoja de estilos web `.css`.
- 1 recurso gráfico `.png`.

El objetivo es que una persona nueva pueda entender qué hace cada archivo,
cómo se conecta con los demás y dónde debe realizar una modificación.

## 2. Organización general

```text
src/
├── aplicacion/       Raíz, sesión y selección de pantallas
├── assets/           Recursos gráficos usados desde el código
├── componentes/      Piezas visuales reutilizables
├── configuracion/    API, navegación y mapas
├── estilos/          Diseño React Native y CSS web
├── ganchos/          Comportamientos React reutilizables
├── modulos/          Pantallas organizadas por función y rol
├── servicios/        GPS, offline, sesión, formato y tiempo real
└── utilidades/       Cálculos generales sin estado ni interfaz
```

Las pantallas no acceden directamente a PostgreSQL. El flujo normal es:

```text
componente de pantalla
  → ClienteApi o servicio offline
  → backend FastAPI
  → respuesta JSON
  → estado React
  → componentes reutilizables
  → estilos
```

## 3. Secuencia de ejecución

Aunque `index.js` está fuera de `src`, es quien inicia esta carpeta:

1. Importa `src/estilos/global`. React Native elige `global.native.js` o
   `global.web.js`.
2. Importa `src/servicios/ubicacionSegundoPlano`. En móvil registra la tarea
   global antes de montar React; en web usa una implementación segura vacía.
3. Registra `src/aplicacion/AplicacionPrincipal.jsx` como raíz.
4. `AplicacionPrincipal` restaura la sesión, observa la red y muestra login o
   panel.
5. `PanelPorRol` lee `configuracion/navegacion.js` y presenta los módulos
   autorizados.

## 4. `aplicacion`: raíz del front-end

### `src/aplicacion/AplicacionPrincipal.jsx`

**Función:** compone toda la aplicación. Controla pantalla activa, usuario,
token, restauración de sesión, conexión, sincronización y cierre de sesión.

**Dependencias principales:**

- `sesionSeguimiento` guarda o recupera la sesión.
- `sinConexion` observa la red y sincroniza la cola.
- `ClienteApi` valida `/me` y ejecuta `/logout`.
- `Encabezado`, `MensajeRetroalimentacion` y `LimiteErrorAplicacion` forman el
  marco visible.
- Importa todas las pantallas navegables y las asocia a una clave.

**Importancia:** es el único punto canónico que decide qué pantalla se muestra.
También garantiza que una falla de red no destruya una sesión offline válida.

## 5. `assets`: recursos gráficos

### `src/assets/brand/logo.png`

**Función:** logotipo de Coffee Fly usado por `Encabezado.jsx`.

**Importancia:** mantiene la identidad visual dentro de todas las pantallas.
No debe confundirse con iconos de Expo ubicados en `frontend/assets`, que se
usan para instalación, splash y favicon.

## 6. `componentes/comunes`

### `src/componentes/comunes/CampoFormulario.jsx`

Campo etiquetado basado en `TextInput`. Recibe valor, cambio, estilos y demás
opciones. Para contraseñas agrega un botón accesible de mostrar/ocultar. Lo usan
login, usuarios y solicitudes para no duplicar controles.

### `src/componentes/comunes/Encabezado.jsx`

Muestra `logo.png`, la marca Coffee Fly y el botón Salir cuando hay usuario.
Recibe `user` y `onLogout`. Permanece visible en toda la sesión.

### `src/componentes/comunes/LimiteErrorAplicacion.jsx`

Error Boundary de React. Captura errores de renderizado, registra el detalle
técnico y ofrece volver al panel sin borrar datos offline. Recibe `children`,
`styles` y `onReset`.

### `src/componentes/comunes/MensajeRetroalimentacion.jsx`

Aviso compacto de información, éxito, advertencia o error. Gestiona cierre por
tiempo, botón `×`, accesibilidad y enfoque web. Sustituye mensajes invasivos y
es utilizado por prácticamente todos los módulos.

## 7. `componentes/entregas`

### `src/componentes/entregas/BandejaMensajesEventos.jsx`

Consulta novedades de entregas, filtra por recolección y estado y permite al
Coordinador eliminar mensajes con confirmación. El Caficultor solo consulta.
Recibe `token`, `styles` y `role`; usa sondeo y `/entregas/eventos/*`.

### `src/componentes/entregas/ReportadorNovedadConductor.jsx`

Permite al Conductor reportar retraso, llegada, daño, parada o imprevisto y ver
eventos recientes. Recibe la entrega, token y estilos. Usa
`GET/POST /entregas/{id}/eventos-conductor`.

## 8. `componentes/mapas`

### `src/componentes/mapas/MapaFlota.native.jsx`

Mapa Android/iOS de vehículos activos con React Native Maps y OpenStreetMap.
Filtra coordenadas, encuadra marcadores y muestra una alternativa segura cuando
el mapa nativo no está disponible.

### `src/componentes/mapas/MapaFlota.web.jsx`

Equivalente web construido con Leaflet. Crea el mapa una sola vez, actualiza
marcadores circulares, ajusta límites y libera recursos al desmontarse.

### `src/componentes/mapas/MapaSeguimiento.web.jsx`

Dibuja en web la polilínea de una entrega, el último punto del vehículo y el
destino actual. Reacciona a nuevos puntos sin recrear el mapa completo.

### `src/componentes/mapas/MarcadorVehiculo.native.jsx`

Marcador móvil basado en `AnimatedRegion`. Anima el movimiento entre una
coordenada anterior y la siguiente para evitar saltos visuales.

### `src/componentes/mapas/SelectorUbicacionCooperativa.native.jsx`

Selector móvil de ubicación. Permite tocar el mapa o arrastrar el marcador y
entrega la coordenada mediante `onSelect`.

### `src/componentes/mapas/SelectorUbicacionCooperativa.web.jsx`

Selector web equivalente con Leaflet. Mantiene la callback actualizada y mueve
el marcador al punto seleccionado.

### `src/componentes/mapas/VistaPreviaRuta.native.jsx`

Vista de respaldo sin proveedor de mapas. Proyecta coordenadas dentro de un
contenedor y dibuja segmentos, vehículo y destino usando componentes nativos.

## 9. `configuracion`

### `src/configuracion/ClienteApi.js`

Es el único cliente HTTP general del front-end.

**Responsabilidades:**

- Limpia la URL configurada.
- En web usa `/api` para que Nginx redirija al backend.
- En un teléfono conectado por LAN obtiene la IP del host de Metro.
- En emulador Android usa `http://10.0.2.2:8000` como último recurso.
- Aplica timeout de 15 segundos por defecto.
- Reintenta únicamente métodos seguros (`GET`, `HEAD`, `OPTIONS`).
- Reintenta estados temporales 408, 425, 429, 502, 503 y 504.
- Convierte fallos de red en un mensaje comprensible que protege datos offline.
- Notifica a `AplicacionPrincipal` cuando una petición autenticada recibe 401.
- Respeta una cancelación externa mediante `AbortSignal`.

**Exporta:** `resolveApiBaseUrl`, `API_BASE_URL`,
`subscribeSessionExpired` y `fetchApi`.

**Importancia:** impide que cada pantalla implemente timeouts, reintentos y
mensajes diferentes.

### `src/configuracion/disponibilidadMapa.js`

Exporta `isNativeMapAvailable`. En Android permite el mapa cuando hay clave de
Google Maps o la aplicación corre dentro de Expo Go. En otras plataformas no
exige esa condición. Está separada para poder probar esta regla sin montar un
mapa.

### `src/configuracion/index.js`

Reexporta el cliente API. Permite importar desde `../../configuracion` sin
conocer el nombre exacto del archivo interno y facilita reorganizaciones.

### `src/configuracion/mapasNativos.js`

Lee Expo Constants, detecta si la ejecución ocurre en Expo Go y si el build
recibió una clave de Google Maps. Exporta `RUNNING_IN_EXPO_GO` y
`NATIVE_MAP_AVAILABLE` para los componentes móviles.

### `src/configuracion/navegacion.js`

Declara todas las claves de pantalla en `APP_SCREEN_KEYS` y las tarjetas de
acceso de cada rol en `ROLE_CARDS`.

**Accesos:**

- Caficultor: finca, solicitud, actividad, historial y seguimiento.
- Registrador: usuarios, cooperativas y vehículos.
- Coordinador: recolección, asignación, flota, historial, seguimiento,
  monitoreo, asignaciones y reportes.
- Conductor: entregas asignadas y GPS/trayecto.

También exporta funciones para detectar tarjetas que apuntan a pantallas no
registradas. La prueba de navegación usa estas funciones.

## 10. `estilos`

### `src/estilos/colores.js`

Paleta central: crema, lima, verde, bosque, blanco, tinta, error, éxito y texto
suave. Cambiar aquí modifica el color compartido sin recorrer las pantallas.

### `src/estilos/global.native.js`

Entrada nativa intencionalmente vacía. Indica que Android/iOS usan
`StyleSheet`, pero permite que `index.js` importe siempre la misma ruta global.

### `src/estilos/global.web.js`

Importa `web.css`. React Native Web selecciona este archivo en navegador.

### `src/estilos/index.js`

Combina estructura, formularios, tarjetas y operación con
`StyleSheet.create`. Exporta el objeto `styles` consumido por la aplicación.

### `src/estilos/web.css`

CSS exclusivo del navegador. Da altura y margen correcto a `html`, `body` y
`#root`, define fondo, tipografía, color base y `box-sizing` global.

### `src/estilos/secciones/estructura.js`

Estilos de Safe Area, encabezado, logo, marca, banner de conexión, página,
contenido, títulos, secciones y cuadrícula responsive.

### `src/estilos/secciones/formularios.js`

Estilos de etiquetas, campos, áreas de texto, formularios, filas, botones,
enlaces, errores, éxito, texto secundario, valores de solo lectura y controles
deshabilitados.

### `src/estilos/secciones/operacion.js`

Estilos específicos del negocio: mapas, grupos de bultos, estados, historial,
cabecera/formulario de recolección, peso total y acciones de ubicación.

### `src/estilos/secciones/tarjetas.js`

Tarjetas responsive, selección, filtros y conteos por rol, métricas del panel y
tarjetas de ancho completo.

## 11. `ganchos`

### `src/ganchos/usarSondeo.js`

Hook que ejecuta una tarea inmediatamente y vuelve a ejecutarla tras un
intervalo.

**Protecciones:**

- No inicia otra consulta si la anterior continúa.
- Pausa cuando la aplicación pasa a segundo plano.
- Reanuda al volver a primer plano.
- Un error temporal no detiene ejecuciones futuras.
- Limpia temporizador y listener al desmontarse.

Lo usan panel, mensajes, entregas, vehículos y monitoreo para refrescar datos
sin fugas de memoria ni consultas superpuestas.

## 12. `modulos/autenticacion`

### `src/modulos/autenticacion/IniciarSesion.jsx`

Formulario de correo y contraseña. Valida datos, llama `POST /login`, evita
doble envío y entrega usuario/token a `AplicacionPrincipal`. Usa
`CampoFormulario` y `MensajeRetroalimentacion`.

## 13. `modulos/caficultor`

### `src/modulos/caficultor/MiActividad.jsx`

Consulta periódicamente `/solicitudes/mis-solicitudes` y muestra solicitudes,
entregas, estados, bultos, pesos y fechas del Caficultor autenticado.

### `src/modulos/caficultor/SolicitarRecoleccion.jsx`

Permite uno o varios grupos de bultos, calcula el total y genera un UUID de
idempotencia. Envía mediante la cola offline para no perder la solicitud ni
duplicarla al recuperar internet.

### `src/modulos/caficultor/UbicacionFinca.native.jsx`

Solicita permiso móvil, captura GPS preciso, guarda copia local y envía o
encola la ubicación de la finca. Esa coordenada será el primer destino del
Conductor.

### `src/modulos/caficultor/UbicacionFinca.web.jsx`

Versión web que usa geolocalización del navegador y el mismo contrato offline,
sin importar módulos nativos incompatibles.

## 14. `modulos/cooperativas`

### `src/modulos/cooperativas/GestionCooperativas.jsx`

CRUD completo de cooperativas. Permite detectar ubicación actual, completar
departamento/municipio/barrio mediante geocodificación inversa y corregir el
punto manualmente con el selector de mapa. Valida contacto, dirección y
coordenadas antes de llamar `/cooperativas`.

## 15. `modulos/entregas`

### `src/modulos/entregas/EntregasAsignadas.jsx`

Lista de trabajo del Conductor. Consulta sus entregas y trazabilidad, permite
cambiar estados válidos y utiliza la cola offline. No habilita `entregado`
antes de confirmar que la carga fue recogida. Detiene GPS al terminar/cancelar.

### `src/modulos/entregas/HistorialAsignaciones.jsx`

Muestra caficultor, peso, vehículo, conductor, Coordinador responsable y fecha
de cada asignación. Usa `/entregas/historial-asignaciones`.

### `src/modulos/entregas/HistorialEntregas.jsx`

Consulta paginada de entregas. Filtra por rango de fechas, Caficultor, vehículo
y estado; presenta 20 elementos por página.

### `src/modulos/entregas/RegistrarRecoleccionCafe.jsx`

Pantalla principal del Coordinador para convertir una solicitud activa en
entrega. Muestra peso bloqueado, observaciones, botón de registro, entregas del
día e historial. Se actualiza cada 15 segundos.

## 16. `modulos/panel`

### `src/modulos/panel/PanelPorRol.jsx`

Consulta `/dashboard`, muestra métricas y genera accesos con `ROLE_CARDS`.
Guarda una copia offline del último panel. Coordinador y Caficultor incluyen la
bandeja de eventos.

## 17. `modulos/reportes`

### `src/modulos/reportes/Reportes.jsx`

Genera reportes de hasta 30 días. Presenta café por Caficultor, entregas por
vehículo y resumen diario. En web crea una descarga Blob; en móvil guarda en
caché y abre Expo Sharing. Exporta PDF o Excel.

## 18. `modulos/seguimiento`

### `src/modulos/seguimiento/MonitoreoOperativo.jsx`

Panel del Coordinador con vehículos en camino, GPS actualizado/desactualizado,
última lectura y métricas backend. Usa sondeo y resuelve automáticamente el
`MapaFlota` apropiado.

### `src/modulos/seguimiento/SeguimientoVehiculo.native.jsx`

Núcleo móvil del viaje. Selecciona entrega según rol, consulta seguimiento,
recibe WebSocket, guarda ruta, inicia/detiene GPS, dibuja mapa o vista previa,
reporta eventos y cambia estado.

Para el Conductor dirige primero a la finca. Cuando el backend confirma que
está dentro del radio permitido, habilita confirmar carga y cambia el destino a
la cooperativa.

### `src/modulos/seguimiento/SeguimientoVehiculo.web.jsx`

Versión web de consulta y supervisión. Mantiene sondeo, WebSocket y selección
por rol, muestra `MapaSeguimiento.web` y abre el destino en un mapa externo. No
intenta ejecutar ubicación móvil en segundo plano.

## 19. `modulos/usuarios`

### `src/modulos/usuarios/GestionUsuarios.jsx`

CRUD de usuarios y estado de cuenta. Incluye filtros con conteo total por rol,
contraseña, datos territoriales del Caficultor y licencia/foto del Conductor.
Permite editar, habilitar, desbloquear, deshabilitar y eliminar.

## 20. `modulos/vehiculos`

### `src/modulos/vehiculos/AsignacionVehiculos.jsx`

Consulta en paralelo entregas, vehículos, conductores y cooperativas
disponibles. Filtra vehículos por capacidad, obliga a seleccionar los cuatro
elementos y llama `/entregas/{id}/asignar-vehiculo`.

### `src/modulos/vehiculos/EstadoVehiculos.jsx`

Panel periódico de la flota con placa, tipo, modelo, capacidad, conductor y
estado. Consume `/vehiculos/estado`.

### `src/modulos/vehiculos/GestionVehiculos.jsx`

CRUD de vehículos. Valida placa, capacidad y modelo entre el año 2000 y el año
siguiente al actual. Administra estado y conductor asociado.

## 21. `servicios`: reglas y soporte no visual

### `src/servicios/calidadGps.js`

**Exporta:** límites de precisión/velocidad, `distanceMeters`, `createGpsPoint`,
`evaluateGpsPoint` y `canStartTrackingFromGpsResult`.

Calcula distancia Haversine, normaliza una lectura del sistema y rechaza puntos
con baja precisión, velocidad imposible, salto excesivo o campos inválidos.
Evita contaminar la ruta y la distancia recorrida.

### `src/servicios/cifradoSinConexion.native.js`

Genera y guarda una clave AES en Secure Store. Cifra con AES-256-GCM textos
sensibles de la cola y reconoce el prefijo versionado `enc:v1`. También puede
migrar un valor antiguo sin cifrar mediante `ensureEncryptedOfflineText`.

### `src/servicios/estadoCuenta.js`

Convierte campos técnicos (`habilitado`, `bloqueado_hasta`, intentos) en un
estado presentable y procesa listas completas. Lo utiliza Gestión de Usuarios.

### `src/servicios/historialEntregas.js`

Recibe varias entregas, agrupa sus IDs y solicita historiales por lote. Devuelve
un objeto indexado por entrega y evita una petición HTTP por cada tarjeta.

### `src/servicios/politicaContrasena.js`

Centraliza texto de ayuda y validación de contraseñas: entre 7 y 20 caracteres,
con mayúscula y minúscula. Permite que formulario y prueba usen la misma regla.

### `src/servicios/politicaSegundoPlano.js`

Detecta modo de ahorro o batería baja y devuelve intervalos GPS adecuados. En
modo ahorro reduce frecuencia para prolongar batería sin detener seguimiento.

### `src/servicios/politicaSincronizacion.js`

Calcula espera exponencial hasta un máximo de 15 minutos y clasifica fallos en
reintentar, conservar para diagnóstico, requerir autenticación o conflicto.

### `src/servicios/presentacionCarga.js`

Calcula peso de un grupo, suma varios grupos y formatea kilogramos, toneladas y
resumen de bultos. Evita repetir cálculos y formatos en varias pantallas.

### `src/servicios/presentacionConexion.js`

Convierte estados internos de red y sincronización en etiquetas en español que
aparecen en el banner global.

### `src/servicios/presentacionSeguimiento.js`

Convierte estados del WebSocket en texto y explica si el rastreo usa tarea de
segundo plano, primer plano de Expo Go o se encuentra detenido.

### `src/servicios/propietarioSinConexion.js`

Obtiene el identificador del dueño de una sesión, crea claves locales aisladas,
comprueba propiedad y asigna dueño a registros antiguos. Impide mezclar datos
offline cuando varios usuarios utilizan el mismo teléfono.

### `src/servicios/seguimientoTiempoReal.js`

Construye URL `ws/wss`, conecta con token y entrega, envía autenticación,
mantiene estado de conexión, fusiona puntos sin duplicados y reconecta con
espera controlada. Interpreta snapshots y actualizaciones del backend.

### `src/servicios/sesionSeguimiento.native.js`

Guarda sesión autenticada y entrega activa en Expo Secure Store con acceso
después del primer desbloqueo. Expone guardar, obtener y limpiar ambos datos.

### `src/servicios/sesionSeguimiento.web.js`

Mantiene token y usuario en memoria de la pestaña. No guarda el token en
`localStorage`, reduciendo su exposición ante scripts. La sesión se pierde al
recargar y debe iniciarse nuevamente.

### `src/servicios/sinConexion.native.js`

Motor offline móvil basado en SQLite.

**Tablas locales:**

- `sync_queue`: operaciones pendientes.
- `sync_rejected`: operaciones no recuperables para diagnóstico.
- `sync_state`: cachés y estados persistentes.

**Opera con:** solicitudes, ubicación de finca, cambios de estado y puntos GPS.
Asigna dueño, cifra payloads, controla 50 MB, evita duplicados, envía lotes de
hasta 200 puntos, conserva rutas/cachés, procesa conflictos y reintenta cuando
NetInfo informa conexión.

### `src/servicios/sinConexion.web.js`

Implementación web del contrato offline. Utiliza `localStorage`, limita la cola
a 4 MB, migra registros antiguos, aísla por usuario y sincroniza solicitudes,
finca y estados. No almacena GPS de segundo plano porque el navegador no ofrece
ese servicio equivalente.

### `src/servicios/ubicacionSegundoPlano.native.js`

Registra la tarea `coffee-fly-background-location` con Expo Task Manager.
Solicita permisos, consulta batería, decide perfil de consumo, observa GPS en
primer plano o inicia actualizaciones de segundo plano. Valida cada punto,
guarda el último y lo envía mediante el motor offline-first. También detiene la
tarea y expone un diagnóstico de permisos/servicios.

### `src/servicios/ubicacionSegundoPlano.web.js`

Implementación compatible para navegador. Conserva las mismas funciones para
que los componentes puedan importarlas, pero informa que el rastreo de fondo
no está disponible y no intenta usar APIs nativas.

## 22. `utilidades`

### `src/utilidades/calculosRuta.js`

Contiene tres funciones puras:

- `sampleCoordinates`: reduce rutas extensas conservando inicio y final.
- `projectCoordinates`: convierte latitud/longitud en posiciones X/Y dentro de
  un contenedor.
- `lineBetween`: calcula longitud, posición y ángulo del segmento entre dos
  puntos.

Las usa `VistaPreviaRuta.native.jsx`. Al estar separadas pueden probarse sin
renderizar React ni cargar un mapa.

## 23. Mapa de dependencias por función

### Inicio de sesión

```text
IniciarSesion
  → CampoFormulario
  → ClienteApi.fetchApi(/login)
  → AplicacionPrincipal
  → sesionSeguimiento
```

### Solicitud offline

```text
SolicitarRecoleccion
  → presentacionCarga
  → sinConexion.encolar
  → politicaSincronizacion
  → ClienteApi
  → /solicitudes/sincronizar
```

### Registro de cooperativa

```text
GestionCooperativas
  → Expo Location o geolocalización web
  → SelectorUbicacionCooperativa.native/web
  → geocodificación inversa
  → ClienteApi
  → /cooperativas
```

### Viaje y GPS

```text
SeguimientoVehiculo.native
  ├─ ubicacionSegundoPlano.native
  │   ├─ calidadGps
  │   ├─ politicaSegundoPlano
  │   └─ sinConexion.native
  ├─ seguimientoTiempoReal
  ├─ MarcadorVehiculo
  ├─ VistaPreviaRuta
  └─ ReportadorNovedadConductor
```

### Monitoreo web/móvil

```text
MonitoreoOperativo
  → usarSondeo
  → ClienteApi(/monitoreo/resumen)
  → MapaFlota.native o MapaFlota.web
```

## 24. Qué archivo modificar según la necesidad

| Necesidad | Archivo principal |
| --- | --- |
| Cambiar URL, timeout o reintentos | `configuracion/ClienteApi.js` |
| Agregar una pantalla | `aplicacion/AplicacionPrincipal.jsx` y `configuracion/navegacion.js` |
| Cambiar menú de un rol | `configuracion/navegacion.js` |
| Cambiar colores | `estilos/colores.js` |
| Cambiar campos y botones | `estilos/secciones/formularios.js` |
| Cambiar tarjetas o filtros | `estilos/secciones/tarjetas.js` |
| Cambiar diseño GPS/recolección | `estilos/secciones/operacion.js` |
| Cambiar regla de contraseña | `servicios/politicaContrasena.js` |
| Cambiar validación GPS | `servicios/calidadGps.js` |
| Cambiar frecuencia GPS | `servicios/politicaSegundoPlano.js` |
| Cambiar cola móvil | `servicios/sinConexion.native.js` |
| Cambiar cola web | `servicios/sinConexion.web.js` |
| Cambiar WebSocket | `servicios/seguimientoTiempoReal.js` |
| Cambiar captura de fondo | `servicios/ubicacionSegundoPlano.native.js` |
| Cambiar formulario de usuarios | `modulos/usuarios/GestionUsuarios.jsx` |
| Cambiar cooperativas/mapa manual | `modulos/cooperativas/GestionCooperativas.jsx` |
| Cambiar recolección | `modulos/entregas/RegistrarRecoleccionCafe.jsx` |
| Cambiar asignación | `modulos/vehiculos/AsignacionVehiculos.jsx` |
| Cambiar trayecto móvil | `modulos/seguimiento/SeguimientoVehiculo.native.jsx` |
| Cambiar reportes/descarga | `modulos/reportes/Reportes.jsx` |

## 25. Reglas para mantener `src`

1. Los componentes React deben usar `.jsx`.
2. La lógica sin interfaz debe permanecer en `.js`.
3. Los nombres deben ser legibles y estar en español.
4. Las diferencias de plataforma usan `.native` y `.web`.
5. Las llamadas HTTP deben pasar por `ClienteApi`.
6. Una regla de seguridad o negocio siempre debe validarse también en backend.
7. Los módulos no deben guardar tokens directamente; usan
   `sesionSeguimiento`.
8. Una operación que debe sobrevivir a la red utiliza `sinConexion`.
9. Los estilos compartidos van en `estilos/secciones`, no en archivos gigantes.
10. Toda pantalla navegable debe estar registrada y tener prueba de navegación.

Para una descripción todavía más extensa de propiedades, estados e interacción
de los 33 JSX, consulte `Docs/DOCUMENTACION-COMPONENTES-FRONTEND.md`. El presente
documento es la referencia completa de toda la carpeta `frontend/src`.
