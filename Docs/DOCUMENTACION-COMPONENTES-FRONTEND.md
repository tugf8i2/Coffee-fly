# Coffee Fly: guía completa de componentes del front-end

## 1. Objetivo

Este documento explica los 33 componentes React activos del front-end de
Coffee Fly. Para cada uno indica dónde está, quién lo utiliza, qué recibe,
qué estado controla, qué servicios consulta, qué puede hacer el usuario y por
qué es importante.

Los componentes visuales usan `.jsx`. Cuando una función no dibuja interfaz se
mantiene como servicio `.js`. Los archivos `.native.jsx` se ejecutan en Android
y iOS; los `.web.jsx` se ejecutan en el navegador. La importación se hace sin
el sufijo de plataforma y React Native escoge automáticamente el correcto.

## 2. Cómo se conectan los componentes

```text
index.js
  └─ AplicacionPrincipal
      ├─ Encabezado
      ├─ MensajeRetroalimentacion
      ├─ LimiteErrorAplicacion
      └─ pantalla seleccionada
          ├─ IniciarSesion
          ├─ PanelPorRol
          ├─ módulos del Caficultor
          ├─ módulos del Registrador
          ├─ módulos del Coordinador
          └─ módulos del Conductor
```

`AplicacionPrincipal` entrega a las pantallas cuatro propiedades compartidas:

| Propiedad | Contenido | Uso |
| --- | --- | --- |
| `user` | Usuario autenticado y rol. | Determina permisos y presentación. |
| `token` | JWT de la sesión. | Autoriza llamadas a FastAPI. |
| `go` | Función para cambiar de pantalla. | Navegación sin recargar la aplicación. |
| `styles` | Hoja de estilos compartida. | Mantiene diseño uniforme. |

## 3. Componente principal

### 3.1 `AplicacionPrincipal.jsx`

**Ubicación:** `frontend/src/aplicacion/AplicacionPrincipal.jsx`

**Responsabilidad:** es la raíz funcional del front-end. No representa un solo
módulo de negocio; organiza sesión, navegación, conexión, sincronización y
protección general de errores.

**Estado que controla:**

- `screen`: nombre de la pantalla visible.
- `user`: usuario autenticado.
- `connectionStatus`: comprobando, en línea o sin conexión.
- `syncStatus`: estado de la cola offline.
- `syncMessage` y `syncMessageType`: aviso global.
- `restoring`: indica si se está recuperando la sesión guardada.

**Funcionamiento:**

1. Al abrir la aplicación consulta la sesión local.
2. Si hay una sesión, valida el token con `GET /me`.
3. Si falla únicamente la red, conserva la sesión para permitir modo offline.
4. Si el servidor rechaza la sesión, borra el acceso local.
5. Observa cambios de conectividad y sincroniza operaciones pendientes.
6. Construye el mapa de pantallas y renderiza solo la elegida.
7. Al salir detiene GPS, llama `POST /logout` y limpia la sesión.

**Componentes hijos:** `Encabezado`, `MensajeRetroalimentacion`,
`LimiteErrorAplicacion` y todas las pantallas descritas abajo.

**Importancia:** es el punto central de control. Sin este componente no habría
sesión persistente, navegación, recuperación offline ni manejo uniforme de
errores.

## 4. Componentes comunes

### 4.1 `CampoFormulario.jsx`

**Ubicación:** `frontend/src/componentes/comunes/CampoFormulario.jsx`

**Recibe:** `label`, `value`, `onChangeText`, `secureTextEntry`, `styles` y las
demás propiedades compatibles con `TextInput`.

**Qué hace:** muestra una etiqueta y un campo de texto uniforme. Si es una
contraseña agrega el botón accesible para mostrar u ocultar el contenido.

**Estado interno:** `visible`, usado solamente para alternar la contraseña.

**Lo usan:** `IniciarSesion`, `GestionUsuarios` y `SolicitarRecoleccion`.

**Importancia:** evita repetir formularios y conserva comportamiento,
accesibilidad y apariencia consistentes.

### 4.2 `Encabezado.jsx`

**Ubicación:** `frontend/src/componentes/comunes/Encabezado.jsx`

**Recibe:** `user` y `onLogout`.

**Qué hace:** muestra el logotipo, el nombre Coffee Fly y, cuando existe una
sesión, el botón `Salir`.

**Lo usa:** `AplicacionPrincipal` en todas las pantallas.

**Importancia:** identifica la aplicación y mantiene el cierre de sesión
disponible desde cualquier módulo.

### 4.3 `LimiteErrorAplicacion.jsx`

**Ubicación:** `frontend/src/componentes/comunes/LimiteErrorAplicacion.jsx`

**Tipo:** componente de clase porque usa el mecanismo `Error Boundary` de
React.

**Recibe:** `children`, `styles` y `onReset`.

**Qué hace:** si un componente hijo falla durante el renderizado, reemplaza la
pantalla dañada con un mensaje seguro y un botón para volver al panel. Registra
el error técnico en desarrollo sin mostrar tokens ni datos GPS al usuario.

**Importancia:** impide que un fallo visual deje toda la aplicación en blanco;
los datos offline permanecen intactos.

### 4.4 `MensajeRetroalimentacion.jsx`

**Ubicación:** `frontend/src/componentes/comunes/MensajeRetroalimentacion.jsx`

**Recibe:** `children`, `type`, `durationMs` y `onDismiss`.

**Tipos:** información, éxito, advertencia y error, cada uno con color e icono.

**Qué hace:** muestra un aviso compacto, limita su anchura, anuncia errores a
lectores de pantalla, se oculta automáticamente y responde al botón `×`.

**Estado interno:** controla si el mensaje sigue visible y mantiene una
referencia para enfocar el aviso en web.

**Importancia:** centraliza todos los mensajes emergentes y evita los avisos
grandes que antes bloqueaban la interfaz.

## 5. Componentes de entregas y novedades

### 5.1 `BandejaMensajesEventos.jsx`

**Ubicación:** `frontend/src/componentes/entregas/BandejaMensajesEventos.jsx`

**Recibe:** `token`, `styles` y `role`.

**Lo usa:** `PanelPorRol` para Coordinador y Caficultor.

**API:**

- `GET /entregas/eventos/notificaciones` para cargar novedades.
- `DELETE /entregas/eventos/{evento}` para que el Coordinador elimine una.

**Qué muestra:** botón para abrir/cerrar la bandeja, filtros por recolección y
estado, caficultor, conductor, vehículo, peso, tipo de evento, detalle y fecha.

**Estado interno:** mensajes, apertura, filtros, menú de recolección, error y
confirmación previa a eliminar.

**Actualización:** utiliza `usarSondeo` para refrescarse periódicamente.

**Importancia:** comunica retrasos, llegadas, daños e imprevistos sin mezclar
las novedades de distintas cargas.

### 5.2 `ReportadorNovedadConductor.jsx`

**Ubicación:** `frontend/src/componentes/entregas/ReportadorNovedadConductor.jsx`

**Recibe:** `deliveryId`, `token` y `styles`.

**Lo usa:** seguimiento del vehículo cuando el usuario es Conductor.

**API:** `GET` y `POST /entregas/{id}/eventos-conductor`.

**Qué permite:** elegir retraso, llegada, inconveniente, entrega realizada,
daño vehicular, parada de baño o imprevisto nuevo; puede agregar un detalle y
enviar la novedad. También muestra los eventos recientes de ese viaje.

**Estado interno:** lista de eventos, menú abierto, tipo seleccionado, detalle,
mensaje, error y guardado en curso.

**Importancia:** proporciona comunicación trazable desde el recorrido y evita
que una novedad quede únicamente en una llamada verbal.

## 6. Componentes de mapas

### 6.1 `MapaFlota.native.jsx`

**Ubicación:** `frontend/src/componentes/mapas/MapaFlota.native.jsx`

**Recibe:** `vehicles`, una lista de vehículos con latitud, longitud, placa y
estado GPS.

**Qué hace:** filtra coordenadas válidas, calcula el área visible, centra el
mapa y dibuja un marcador por vehículo usando OpenStreetMap como capa. Si el
mapa nativo no está disponible muestra un resumen seguro en texto.

**Lo usa:** `MonitoreoOperativo` en Android/iOS.

**Importancia:** permite al Coordinador ver la flota activa sin que una clave de
mapa ausente cierre la aplicación.

### 6.2 `MapaFlota.web.jsx`

**Ubicación:** `frontend/src/componentes/mapas/MapaFlota.web.jsx`

**Recibe:** `vehicles`.

**Qué hace:** crea y destruye correctamente una instancia Leaflet, agrega capa
OpenStreetMap, dibuja marcadores circulares, ajusta los límites y actualiza los
marcadores cuando cambia la lista.

**Estado interno:** mapa listo y mensaje de error de carga.

**Lo usa:** `MonitoreoOperativo` en navegador.

**Importancia:** ofrece la misma vista de flota sin depender de componentes
nativos.

### 6.3 `MapaSeguimiento.web.jsx`

**Ubicación:** `frontend/src/componentes/mapas/MapaSeguimiento.web.jsx`

**Recibe:** `destination` y `points`.

**Qué hace:** dibuja la ruta GPS como polilínea, el último punto del vehículo y
el destino actual. Ajusta el encuadre y actualiza capas sin recrear el mapa en
cada lectura.

**Estado interno:** disponibilidad del mapa y error.

**Lo usa:** `SeguimientoVehiculo.web.jsx`.

**Importancia:** transforma la secuencia de coordenadas en una representación
comprensible del recorrido.

### 6.4 `MarcadorVehiculo.native.jsx`

**Ubicación:** `frontend/src/componentes/mapas/MarcadorVehiculo.native.jsx`

**Recibe:** `coordinate`, `title` y `description`.

**Qué hace:** conserva un `AnimatedRegion` y anima el marcador desde su posición
anterior hasta la nueva, en lugar de hacerlo saltar.

**Lo usa:** `SeguimientoVehiculo.native.jsx`.

**Importancia:** hace que la actualización GPS sea visualmente estable y
facilita entender la dirección del movimiento.

### 6.5 `SelectorUbicacionCooperativa.native.jsx`

**Ubicación:**
`frontend/src/componentes/mapas/SelectorUbicacionCooperativa.native.jsx`

**Recibe:** `latitude`, `longitude` y `onSelect`.

**Qué hace:** centra el mapa en las coordenadas existentes o en una posición
regional predeterminada. Al tocar el mapa o arrastrar el marcador entrega la
nueva coordenada a `onSelect`.

**Lo usa:** `GestionCooperativas` en móvil.

**Importancia:** permite corregir manualmente la ubicación aunque el GPS no sea
exacto.

### 6.6 `SelectorUbicacionCooperativa.web.jsx`

**Ubicación:**
`frontend/src/componentes/mapas/SelectorUbicacionCooperativa.web.jsx`

**Recibe:** las mismas propiedades que la versión nativa.

**Qué hace:** usa Leaflet para seleccionar el punto en navegador, mueve el
marcador al hacer clic y conserva una referencia actualizada a `onSelect`.

**Importancia:** mantiene disponible la selección manual en la aplicación web.

### 6.7 `VistaPreviaRuta.native.jsx`

**Ubicación:** `frontend/src/componentes/mapas/VistaPreviaRuta.native.jsx`

**Recibe:** `route`, `vehicle` y `destination`.

**Qué hace:** reduce la cantidad de coordenadas, las proyecta dentro de un
contenedor y dibuja segmentos, origen, vehículo y destino con vistas nativas.

**Lo usa:** seguimiento móvil cuando el mapa completo no está disponible.

**Importancia:** ofrece una ruta útil incluso en un APK sin Google Maps o ante
un problema del proveedor cartográfico.

## 7. Autenticación y panel

### 7.1 `IniciarSesion.jsx`

**Ubicación:** `frontend/src/modulos/autenticacion/IniciarSesion.jsx`

**Recibe:** `onLogin` y `styles`.

**API:** `POST /login`.

**Estado interno:** correo, contraseña, error y carga.

**Qué hace:** valida que ambos campos estén completos, envía credenciales,
interpreta el error del backend y entrega usuario/token a `onLogin`. Mientras
espera deshabilita el botón para impedir envíos repetidos.

**Hijos:** dos `CampoFormulario` y `MensajeRetroalimentacion`.

**Importancia:** establece la sesión que autoriza el resto de la aplicación.

### 7.2 `PanelPorRol.jsx`

**Ubicación:** `frontend/src/modulos/panel/PanelPorRol.jsx`

**Recibe:** `user`, `token`, `go` y `styles`.

**API:** `GET /dashboard/` cada 30 segundos.

**Qué hace:** muestra saludo, fecha de actualización, métricas y tarjetas de
acceso definidas en `configuracion/navegacion.js`. Coordinador y Caficultor
también ven `BandejaMensajesEventos`.

**Modo offline:** guarda el último panel y la hora de sincronización. Si la red
falla recupera esa copia; los errores reales del servidor no se ocultan como si
fueran desconexión.

**Importancia:** es la página inicial y garantiza que cada rol vea únicamente
los módulos que le corresponden.

## 8. Módulos del Caficultor

### 8.1 `SolicitarRecoleccion.jsx`

**Ubicación:** `frontend/src/modulos/caficultor/SolicitarRecoleccion.jsx`

**Recibe:** `go`, `token` y `styles`.

**Qué permite:** agregar varios grupos de bultos con distinto peso y cantidad,
eliminar grupos, escribir observaciones y ver el peso total calculado.

**Estado interno:** grupos, observación, mensaje y tipo de mensaje.

**Envío:** genera `client_request_id` con Expo Crypto y llama
`enviarOSolicitarEnCola`. Si no hay red, la solicitud queda guardada y se envía
después sin duplicarse.

**Importancia:** es el inicio del flujo logístico y conserva el trabajo en zonas
rurales sin conectividad.

### 8.2 `MiActividad.jsx`

**Ubicación:** `frontend/src/modulos/caficultor/MiActividad.jsx`

**API:** `GET /solicitudes/mis-solicitudes` mediante sondeo.

**Qué muestra:** solicitudes activas, resumen de entregas, pesos, grupos de
bultos, estado y fechas del Caficultor autenticado.

**Estado interno:** respuesta del panel y error.

**Importancia:** permite verificar que la solicitud fue recibida y conocer su
avance sin depender del Coordinador.

### 8.3 `UbicacionFinca.native.jsx`

**Ubicación:** `frontend/src/modulos/caficultor/UbicacionFinca.native.jsx`

**Qué hace:** recupera una ubicación guardada, solicita permiso de primer plano,
obtiene coordenadas precisas y las almacena localmente antes de enviarlas o
encolarlas como `ubicacion_finca`.

**Estado interno:** posición y aviso.

**Importancia:** proporciona el primer destino del Conductor y funciona aunque
la finca no tenga conexión al momento del registro.

### 8.4 `UbicacionFinca.web.jsx`

**Ubicación:** `frontend/src/modulos/caficultor/UbicacionFinca.web.jsx`

**Qué hace:** utiliza la geolocalización del navegador, conserva la última
posición local y emplea la misma cola offline de ubicación de finca.

**Importancia:** permite completar el perfil desde web sin importar componentes
nativos de Expo Location.

## 9. Módulo del Registrador: cooperativas

### 9.1 `GestionCooperativas.jsx`

**Ubicación:** `frontend/src/modulos/cooperativas/GestionCooperativas.jsx`

**API:** CRUD `/cooperativas`.

**Qué permite:** crear, editar, listar y eliminar cooperativas con nombre,
teléfono, correo, departamento, municipio, dirección, latitud y longitud.

**Ubicación automática:**

- solicita ubicación actual con Expo Location;
- en móvil usa geocodificación inversa de Expo;
- en web usa Nominatim u `EXPO_PUBLIC_REVERSE_GEOCODING_URL`;
- completa departamento, ciudad y barrio/zona cuando la respuesta los incluye.

**Ubicación manual:** abre `SelectorUbicacionCooperativa`; cada punto elegido
actualiza las coordenadas y vuelve a intentar completar la dirección.

**Estado interno:** listado, formulario, elemento editado, confirmación de
eliminación, mensajes, guardado, captura GPS, geocodificación y mapa visible.

**Validaciones:** campos completos, teléfono de 10 dígitos y coordenadas
numéricas. La eliminación exige confirmación dentro de la pantalla.

**Importancia:** la cooperativa será el segundo destino del Conductor después
de recoger la carga, por lo que sus coordenadas deben ser confiables.

## 10. Módulos de usuarios y vehículos

### 10.1 `GestionUsuarios.jsx`

**Ubicación:** `frontend/src/modulos/usuarios/GestionUsuarios.jsx`

**API:** CRUD `/usuarios` y `PUT /usuarios/{id}/estado`.

**Qué permite:** crear, editar, habilitar, desbloquear, deshabilitar y eliminar
usuarios. Muestra tarjetas por rol con el total de Registradores, Conductores,
Coordinadores y Caficultores.

**Campos especiales:**

- Conductor: licencia B2/B3/C1/C2/C3 y foto de licencia.
- Caficultor: departamento, municipio y vereda.
- Contraseña: validada con la política compartida.

**Estado interno:** usuarios, filtro de rol, estado de cada cuenta, formulario,
edición, mensaje y guardado.

**Importancia:** es el control central de identidades y deja visible cuántos
usuarios existen por rol.

### 10.2 `GestionVehiculos.jsx`

**Ubicación:** `frontend/src/modulos/vehiculos/GestionVehiculos.jsx`

**API:** CRUD `/vehiculos`.

**Qué permite:** registrar, editar, listar y eliminar vehículo; captura placa,
tipo, modelo, capacidad, estado y conductor.

**Validaciones:** placa con formato válido, capacidad positiva y modelo desde
el año 2000 hasta el año siguiente al actual. Solo permite estados iniciales
compatibles, como disponible o en mantenimiento.

**Importancia:** garantiza que solo vehículos válidos y con capacidad conocida
entren al proceso de asignación.

### 10.3 `EstadoVehiculos.jsx`

**Ubicación:** `frontend/src/modulos/vehiculos/EstadoVehiculos.jsx`

**API:** `GET /vehiculos/estado` mediante sondeo.

**Qué muestra:** placa, tipo, modelo, capacidad, estado y conductor de cada
vehículo, con actualización manual y automática.

**Importancia:** permite al Registrador o Coordinador conocer la disponibilidad
real de la flota.

### 10.4 `AsignacionVehiculos.jsx`

**Ubicación:** `frontend/src/modulos/vehiculos/AsignacionVehiculos.jsx`

**API:** consulta en paralelo entregas pendientes, vehículos, conductores y
cooperativas disponibles; después usa
`POST /entregas/{id}/asignar-vehiculo`.

**Flujo:**

1. Elegir recolección.
2. Elegir un vehículo con capacidad suficiente.
3. Elegir conductor compatible.
4. Elegir cooperativa destino.
5. Confirmar asignación.

Si cambia el vehículo y deja de ser compatible, limpia la selección del
conductor. El backend vuelve a validar disponibilidad dentro de una transacción.

**Importancia:** une la carga, el medio de transporte, la persona responsable y
el destino final.

## 11. Módulos de recolección y entrega

### 11.1 `RegistrarRecoleccionCafe.jsx`

**Ubicación:** `frontend/src/modulos/entregas/RegistrarRecoleccionCafe.jsx`

**API:**

- `GET /entregas/solicitudes-activas`.
- `GET /entregas/`.
- `POST /entregas/`.
- historial de estados por lotes mediante servicio auxiliar.

**Qué hace:** el Coordinador selecciona una solicitud activa, revisa el peso
calculado, agrega observaciones y pulsa el botón visible `Registrar recolección
de café`. El peso no puede alterarse en este formulario.

**Estado interno:** solicitudes, entregas, selección, observaciones, mensaje,
error e historiales.

**Actualización:** automática cada 15 segundos y manual mediante botón.

**Importancia:** convierte la petición del Caficultor en una entrega operativa
pendiente de asignación.

### 11.2 `EntregasAsignadas.jsx`

**Ubicación:** `frontend/src/modulos/entregas/EntregasAsignadas.jsx`

**API:** `GET /entregas/mis-asignadas`; los cambios de estado pasan por la cola
offline.

**Qué muestra:** caficultor, peso, placa, estado, fecha, recogida de carga e
historial completo.

**Acciones:** una entrega pendiente puede pasar a `en camino` o cancelarse. Una
entrega en camino solo puede marcarse entregada después de confirmar la carga;
también puede cancelarse. Al finalizar detiene el GPS de segundo plano.

**Importancia:** es la lista de trabajo del Conductor y mantiene trazabilidad
aun cuando el cambio de estado se realice sin red.

### 11.3 `HistorialEntregas.jsx`

**Ubicación:** `frontend/src/modulos/entregas/HistorialEntregas.jsx`

**API:** `GET /entregas/historial`.

**Filtros:** fecha inicial/final, Caficultor, vehículo y estado. Muestra 20
resultados por página y permite avanzar o retroceder.

**Estado interno:** filtros, página, resultado y mensaje de error.

**Importancia:** permite consultar operaciones pasadas sin cargar todas las
entregas en memoria y respeta el alcance autorizado por rol.

### 11.4 `HistorialAsignaciones.jsx`

**Ubicación:** `frontend/src/modulos/entregas/HistorialAsignaciones.jsx`

**API:** `GET /entregas/historial-asignaciones`.

**Qué muestra:** caficultor, peso, vehículo, conductor, Coordinador que realizó
la asignación y fecha.

**Importancia:** responde quién asignó cada recurso y facilita investigar una
decisión operativa.

## 12. Seguimiento y monitoreo

### 12.1 `SeguimientoVehiculo.native.jsx`

**Ubicación:** `frontend/src/modulos/seguimiento/SeguimientoVehiculo.native.jsx`

**Recibe:** `go`, `token`, `styles` y `user`; adapta su comportamiento al rol.

**Selección de entrega:**

- Caficultor: consulta su seguimiento activo.
- Conductor: consulta sus entregas asignadas.
- Coordinador: consulta entregas en camino y puede escoger una.

**Datos:** combina consultas REST periódicas con WebSocket. Conserva rutas
descargadas para mostrarlas sin conexión.

**Flujo del Conductor:**

1. Escoge una entrega y revisa el destino de recolección.
2. Obtiene una ruta vial hacia la finca.
3. Inicia GPS en primer o segundo plano según el entorno.
4. Al llegar dentro del radio permitido confirma la carga.
5. El destino cambia automáticamente a la cooperativa.
6. Puede reportar novedades y cambiar el estado de la entrega.
7. Al finalizar detiene el rastreo.

**Estado interno:** entrega, lista activa, seguimiento, ruta, aviso, GPS,
WebSocket y confirmación de carga.

**Hijos:** mapa nativo, `MarcadorVehiculo`, `VistaPreviaRuta` y
`ReportadorNovedadConductor`.

**Importancia:** es el componente móvil más crítico: conduce el trayecto,
produce la ruta GPS y aplica el cambio finca → cooperativa.

### 12.2 `SeguimientoVehiculo.web.jsx`

**Ubicación:** `frontend/src/modulos/seguimiento/SeguimientoVehiculo.web.jsx`

**Qué comparte con móvil:** selección por rol, consulta REST, sondeo, WebSocket,
información de la etapa y eventos del Conductor.

**Diferencia:** no inicia tareas GPS de segundo plano. Muestra
`MapaSeguimiento.web` y puede abrir el destino en la aplicación cartográfica
del navegador.

**Importancia:** permite supervisión desde computador sin ejecutar APIs nativas
incompatibles con web.

### 12.3 `MonitoreoOperativo.jsx`

**Ubicación:** `frontend/src/modulos/seguimiento/MonitoreoOperativo.jsx`

**API:** `GET /monitoreo/resumen` mediante sondeo.

**Qué muestra:** total en camino, vehículos con GPS actualizado,
desactualizado o sin ubicación, antigüedad del último punto, precisión,
velocidad, rumbo y métricas del proceso backend.

**Hijo:** `MapaFlota`, resuelto en versión nativa o web.

**Importancia:** permite detectar rápidamente teléfonos que dejaron de enviar
posición o viajes que requieren intervención.

## 13. Reportes

### 13.1 `Reportes.jsx`

**Ubicación:** `frontend/src/modulos/reportes/Reportes.jsx`

**API:** `GET /reportes/` y `GET /reportes/exportar`.

**Qué permite:** seleccionar hasta 30 días, generar el informe y mostrar café
por Caficultor, entregas por vehículo y resumen diario.

**Exportación web:** descarga el archivo como `Blob` y crea temporalmente un
enlace del navegador.

**Exportación móvil:** descarga en la caché con Expo File System y abre la hoja
de compartir mediante Expo Sharing.

**Estado interno:** fechas, resultado, mensaje y tipo de mensaje.

**Importancia:** transforma los registros operativos en información consultable
y archivos PDF/Excel que pueden guardarse o enviarse.

## 14. Resumen por rol

| Rol | Componentes principales |
| --- | --- |
| Todos | `AplicacionPrincipal`, `Encabezado`, `IniciarSesion`, `PanelPorRol`, `MensajeRetroalimentacion`, `LimiteErrorAplicacion`. |
| Registrador | `GestionUsuarios`, `GestionCooperativas`, selectores de mapa, `GestionVehiculos`. |
| Caficultor | `SolicitarRecoleccion`, `UbicacionFinca`, `MiActividad`, seguimiento y bandeja de eventos. |
| Coordinador | `RegistrarRecoleccionCafe`, `AsignacionVehiculos`, historiales, `EstadoVehiculos`, seguimiento, monitoreo, bandeja y reportes. |
| Conductor | `EntregasAsignadas`, seguimiento móvil/web y `ReportadorNovedadConductor`. |

## 15. Regla para crear componentes nuevos

1. Crear el `.jsx` dentro del módulo al que pertenece.
2. Usar un nombre en español que describa su responsabilidad.
3. Recibir datos por propiedades; no leer variables globales innecesarias.
4. Usar `ClienteApi` en lugar de repetir manejo de timeout y errores.
5. Mantener las reglas de negocio críticas en el backend.
6. Usar `MensajeRetroalimentacion` para avisos.
7. Agregar la pantalla a `AplicacionPrincipal` y a `navegacion.js` si es un
   módulo navegable.
8. Crear variantes `.native.jsx` y `.web.jsx` si usa APIs exclusivas de una
   plataforma.
9. Reutilizar estilos de `src/estilos`; no crear grandes bloques inline.
10. Añadir una prueba que compruebe su flujo o sus servicios principales.

Esta organización permite localizar rápidamente qué componente corresponde a
cada función y evita que autenticación, GPS, formularios y reglas operativas se
mezclen en un único archivo.
