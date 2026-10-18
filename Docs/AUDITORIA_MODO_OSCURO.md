# Auditoría del modo oscuro

Revisión del 17 de octubre de 2026. Alcance: perfiles y secciones visibles en la web y en la APK que carga esa interfaz.

| Perfil | Secciones revisadas en código | Hallazgo |
| --- | --- | --- |
| Registrador | Inicio, cooperativas, vehículos, usuarios, reportes, configuración y seguridad de dispositivos | El panel guarda `preferences.dark` por su cuenta. Las pantallas de operaciones reciben `darkMode` de la aplicación principal, que puede continuar en `false`; el tema del marco y el del contenido pueden diferir. |
| Coordinador | Inicio, solicitudes, asignaciones, vehículos, conductores, mapa en vivo, reportes, notificaciones y cuenta | El panel también guarda el tema por separado. Sus mapas de flota y ruta no reciben el tema oscuro. |
| Caficultor | Inicio, solicitud, actividad e historial, finca, seguimiento, servicio al cliente y preferencias | El marco guarda el tema por separado, mientras sus pantallas reciben el estado de la aplicación principal. El selector de ubicación mantiene el mapa diurno. |
| Conductor | Inicio, ruta, entregas, checklist, novedades, servicio al cliente, perfil y preferencias | El tema general ya usa el estado compartido. El mapa de seguimiento web inicia de día aunque el perfil esté en modo oscuro. |

Cambios conjuntos aplicados: el tema de los cuatro perfiles usa el estado compartido por cuenta, con lectura de las preferencias antiguas cuando todavía no existe una preferencia compartida. Los mapas de flota, ruta, finca y cooperativas reciben el tema oscuro; el mapa web del conductor sigue el tema del perfil al entrar y conserva su control manual de día/noche. `npm run export:web` terminó correctamente y regeneró el shell sin conexión. Después corresponde revisar visualmente cada sección en el teléfono y corregir contrastes concretos que aparezcan. No se ha acreditado todavía la revisión visual de todas las secciones.

Primera revisión visual en el teléfono: en el inicio oscuro del conductor, los iconos de las acciones rápidas quedaban demasiado oscuros; también se encontró fondo claro en el resumen de la ruta con texto claro. Se ajustaron iconos, tarjetas y resumen, y se repitió la exportación web. La barra inferior de tiempo, llegada y distancia del GPS se conservó sin cambios, como indicó el usuario.

Segundo barrido por perfiles y secciones: se localizaron contrastes fijos en los avisos del registrador y en su menú de cuenta; en el coordinador, la notificación emergente, las tarjetas de métricas ámbar y azul y las etiquetas de estado conservaban colores claros al activar el tema oscuro. Se aplicaron juntos los ajustes de contraste y la exportación web terminó correctamente. Caficultor y conductor comparten los controles y avisos del marco operativo; queda pendiente la revisión visual del usuario en cada sección para registrar defectos que solo aparezcan con datos reales.

Una captura posterior de «Solo mapa» en el teléfono mostró los controles de voz, novedad y centrado con poco contraste sobre el mapa oscuro. Se fijó un fondo claro para esos controles y se identificó explícitamente el botón de centrado para accesibilidad. La exportación web pasó. Falta recargar esa vista y verificar el resultado visual en el dispositivo; no se modificó la barra inferior de tiempo, llegada y distancia.
