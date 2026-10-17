# Misión activa de Coffee Fly

Estado al 16 de octubre de 2026 (hora de Colombia).

## Resultado que debe aprobar el usuario antes de publicar

- Mantener en la APK el diseño de la compilación 3 para el inicio y los perfiles, conservando las funciones recientes.
- Crear y aceptar una carga con una cuenta de conductor; comprobar navegación, GPS, fotos y entrega en un dispositivo real.
- Mantener sesión y ruta completa al cerrar la APK y abrirla sin Internet; sincronizar los cambios al recuperar la conexión.
- Revisar el modo oscuro en todos los perfiles y pantallas, con texto, iconos, botones y mapas legibles.
- Incorporar llamadas dentro de la APK entre coordinador y conductor, con entrada de llamadas, micrófono, altavoz y opción visible para compartir cámara durante la llamada.
- Añadir al panel administrador un inventario de dispositivos de la empresa que identifique cada instalación y modelo de teléfono, cuenta y perfil con sesión abierta, hora de inicio, último contacto y ubicación autorizada. Permitir cerrar remotamente una sesión específica y comprobar que el dispositivo pierde acceso cuando recibe la revocación.
- Mantener el seguimiento de ubicación durante la ruta, incluso cuando la aplicación esté en segundo plano si el sistema y los permisos concedidos lo permiten, con autorización y una indicación visible al conductor. Mostrar al administrador la última posición, su hora y si está actualizada; sincronizar posiciones pendientes al recuperar Internet.
- Permitir cámara y micrófono únicamente durante llamadas visibles entre coordinador y conductor, con permisos del sistema y controles para aceptar, activar o desactivar cada función. Registrar la autorización necesaria para el uso de dispositivos de la empresa.
- Diseñar y comprobar la desinstalación remota mediante administración corporativa de Android (Device Owner/MDM), incluida la inscripción de los teléfonos. La APK ordinaria no puede desinstalarse a sí misma a distancia; hasta disponer de MDM, la medida inmediata es revocar la sesión y los datos accesibles desde el servidor.
- Mantener las referencias internas solicitadas en los paquetes web y APK sin mostrarlas como contenido principal de la interfaz.
- Mostrar la APK y la web localmente, obtener la aprobación del usuario y solo entonces publicar y desplegar.

## Estado comprobado

- La APK v13 con el diseño web se instaló en el dispositivo y abrió como administrador; se dejó abierta la pantalla Gestión de usuarios.
- Las capturas del inicio, panel y menú de v13 coincidieron píxel por píxel con la compilación 3.
- El puente de sesión segura y la descarga web del corredor tienen pruebas de módulo que pasan y compilan para web y Android. Aún requieren una prueba real en la APK con la web correspondiente.
- No se encontró implementación de llamadas en el código actual.
- En la rama de prueba, la API y el panel del registrador registran la instalación, cuenta, perfil y último contacto, y permiten revocar una sesión específica. La migración sigue pendiente para producción.
- Al cerrar o detectar una sesión revocada, web y APK eliminan las respuestas de API guardadas para esa cuenta; el inventario de seguridad no se guarda en el caché offline.
- La APK local separada (`com.coffeefly.mobile.dev`) se instaló en el teléfono. El conductor inició sesión con la cuenta de prueba y `Admin123`. El panel se restauró tras cerrar y abrir la APK con el servidor local disponible y también después de detener el servidor local. Esta prueba acredita el inicio de la aplicación sin acceso a su origen web, pero todavía no la ruta ni el mapa de una carga activa sin Internet.
- El administrador consultó la instalación real del teléfono (Android CPH2577) y revocó la sesión del conductor. En menos de 35 segundos, la APK mostró la pantalla de inicio de sesión con aviso de sesión vencida. La revocación quedó comprobada físicamente.
- El export web de prueba incluye un manifiesto de JS, CSS, fuentes e imágenes para precargar la interfaz en el service worker. Se observó el inicio sin el servidor local; aún falta probar el mapa de la ruta y la sincronización de acciones offline.
- Una prueba HTTP automatizada confirmó la separación de permisos: el conductor recibe 403 al consultar o revocar sesiones, el administrador recibe 204 al revocarlas, y el token revocado recibe 401 tanto en `/me` como en el latido.
- La base local de prueba ya tiene una finca, cooperativa, vehículo y carga asignada al conductor mediante `scripts/local-preview/seed_trip.py`. La APK mostró la carga TST123, su botón visible «Aceptar e iniciar viaje» y el diálogo de confirmación. El primer toque de confirmación expuso que SQLite no autogeneraba el ID de auditoría; se corrigió el tipo SQLite sin cambiar el tipo PostgreSQL. Tras reiniciar la API local, una petición autenticada a `/viajes/{id}/iniciar` respondió con el viaje en estado `en_camino`. Falta repetir la confirmación desde la APK; la petición API sí verificó la transición.
- El seguimiento de la APK inicialmente no encontraba la entrega porque la carga de prueba omitía su `vehiculo_id`; se corrigió el generador y la base local. Después, el teléfono mostró el viaje activo y la pantalla de navegación con ruta, ubicación, indicación de giro, tiempo estimado y distancia de 19,7 km.
- En el teléfono se concedieron los permisos visibles de actividad física y ubicación precisa. Con Wi-Fi y datos móviles desactivados, se cerró y abrió la APK: permanecieron la sesión, la ruta azul, las maniobras y las teselas del mapa. Al volver la conexión, el panel mostró «Ruta, maniobras y mapa regional listos en este dispositivo». Una segunda prueba sin red mostró el mapa regional y la ruta de extremo a extremo. Se restauraron Wi-Fi y datos móviles al estado previo. No se ha comprobado movimiento GPS real durante el trayecto ni sincronización de cambios hechos offline.
- Al arrastrar el mapa en la APK, el puntero azul permaneció en el centro de la pantalla mientras se desplazaron las calles y la ruta. La prueba se hizo con el teléfono quieto; sigue pendiente comprobar la orientación durante movimiento real.
- Los puntos de control del conductor permiten adjuntar hasta cuatro fotos mediante cámara o galería. El formulario de novedades de ruta todavía muestra que los adjuntos fotográficos no están disponibles; falta implementar y probar ese caso en la APK.
- En la vista física de la ruta, «Confirmar recogida» se ve con texto e icono contrastados y permanece deshabilitado con la explicación «Acércate a la finca y espera un GPS preciso». El teléfono de prueba estaba inmóvil y lejos del destino; no se ha validado la recogida o entrega dentro de la geocerca.
- No se ha publicado una nueva APK ni desplegado estos cambios en Hostless.
