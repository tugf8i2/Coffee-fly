# Misión activa de Coffee Fly

Estado al 15 de octubre de 2026 (hora de Colombia).

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
- En la rama de prueba, la API y el panel del registrador ya registran la instalación, cuenta, perfil y último contacto, y permiten revocar una sesión específica. La prueba local del servidor confirmó que un token revocado recibe 401. Falta la migración y prueba integrada en el teléfono antes de publicar.
- La base de datos consultada solo tenía la cuenta de administrador, sin conductor, vehículo ni cooperativa para la prueba completa.
- No se ha publicado una nueva APK ni desplegado estos cambios en Hostless.
