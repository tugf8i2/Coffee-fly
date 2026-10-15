# Misión activa de Coffee Fly

Estado al 14 de octubre de 2026 (hora de Colombia).

## Resultado que debe aprobar el usuario antes de publicar

- Mantener en la APK el diseño de la compilación 3 para el inicio y los perfiles, conservando las funciones recientes.
- Crear y aceptar una carga con una cuenta de conductor; comprobar navegación, GPS, fotos y entrega en un dispositivo real.
- Mantener sesión y ruta completa al cerrar la APK y abrirla sin Internet; sincronizar los cambios al recuperar la conexión.
- Revisar el modo oscuro en todos los perfiles y pantallas, con texto, iconos, botones y mapas legibles.
- Incorporar llamadas dentro de la APK entre coordinador y conductor, con entrada de llamadas, micrófono, altavoz y opción visible para compartir cámara durante la llamada.
- Añadir al panel administrador un inventario de dispositivos de la empresa con cuenta, perfil, hora de inicio, último contacto y ubicación autorizada; permitir revocar remotamente las sesiones.
- Mantener el seguimiento de ubicación durante la ruta con los permisos del sistema y una indicación visible al conductor. Cámara y micrófono se usan con consentimiento dentro de llamadas visibles.
- Evaluar la desinstalación remota mediante administración corporativa de Android (Device Owner/MDM); una APK ordinaria no tiene permisos para desinstalarse a distancia.
- Mantener las referencias internas solicitadas en los paquetes web y APK sin mostrarlas como contenido principal de la interfaz.
- Mostrar la APK y la web localmente, obtener la aprobación del usuario y solo entonces publicar y desplegar.

## Estado comprobado

- La APK v13 con el diseño web se instaló en el dispositivo y abrió como administrador; se dejó abierta la pantalla Gestión de usuarios.
- Las capturas del inicio, panel y menú de v13 coincidieron píxel por píxel con la compilación 3.
- El puente de sesión segura y la descarga web del corredor tienen pruebas de módulo que pasan y compilan para web y Android. Aún requieren una prueba real en la APK con la web correspondiente.
- No se encontró implementación de llamadas en el código actual.
- La API ya guarda sesiones revocables, pero no registra información de dispositivos ni ofrece un panel para revocar una sesión específica.
- La base de datos consultada solo tenía la cuenta de administrador, sin conductor, vehículo ni cooperativa para la prueba completa.
- No se ha publicado una nueva APK ni desplegado estos cambios en Hostless.
