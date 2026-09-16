# Panel web del coordinador

Se aplica la referencia visual proporcionada por el usuario al panel web del rol `coordinador`: navegación lateral verde, cabecera, ilustración de inicio, tarjetas, tablas, detalle de solicitud, asignación en dos columnas, mapa en vivo, reportes y perfil/configuración. La vista se adapta a celular con menú desplegable y tablas desplazables. Android conserva sus pantallas operativas actuales.

## Datos y permisos

- Las solicitudes activas y las recolecciones consultadas se combinan sin duplicarlas. Las búsquedas ignoran tildes y mayúsculas. Los filtros identifican que abarcan la página consultada, no todo el historial.
- La asignación conserva el registro de recolecciones, la capacidad del vehículo, el máximo de 50 cargas, la documentación del conductor, el destino obligatorio y las asignaciones en espera. Desde el detalle se preselecciona la recolección correspondiente.
- Vehículos y conductores son consultas: crear o editar sigue siendo responsabilidad del registrador. No se amplían permisos del backend.
- Los reportes muestran las recolecciones y kilogramos del período real. Las gráficas agrupan por día y vehículo; no inventan cumplimiento, retrasos ni porcentajes de puntualidad. Se conservan las exportaciones PDF/Excel y el límite de 30 días.
- El mapa conserva MapLibre, las calles reales, las rutas del servidor y los controles de calidad GPS. Una ruta estimada no incluye tráfico en vivo. La línea de etapas muestra hechos registrados, no horas de salida o llegada inventadas.
- Las notificaciones muestran eventos de conductor, no un supuesto contador de mensajes no leídos.
- Perfil: datos del usuario autenticado y avatar neutro. No se usa la foto o identidad ficticia de la plantilla. Preferencias de modo oscuro y densidad se guardan por usuario en este navegador; no simulan preferencias del servidor.
- No existen adjuntos consultables ni edición autónoma de perfil en los servicios actuales. La interfaz indica estas limitaciones.

## Archivos

La composición está en `frontend/src/modulos/coordinador/CoordinadorLayout.web.jsx` y su CSS está aislado en `PanelCoordinador.css`. La asignación separa presentación web y lógica existente. Las ilustraciones de marca se toman de la referencia adjunta. La fuente local disponible es Roboto Condensed; la imagen no incluye archivos CSS ni una especificación de fuente original verificable.

## Verificación

- `cd frontend; npm test -- --watch=false` (117 pruebas).
- `npm run export:web` y exportación Android para verificar resolución de módulos nativos.
- Comprobación de navegador con respuestas API de prueba aisladas: vistas de escritorio/móvil, filtros, paginación, selección desde detalle, capacidad, licencia y cuerpo de asignación. Teselas de calles reales, sin sustituirlas por la imagen de la referencia.
- El despliegue local reconstruye únicamente el frontend, conservando backend, base de datos y Valhalla.
