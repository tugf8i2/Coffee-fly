# Misión: seguridad de dispositivos y comunicación en ruta

Estado: en desarrollo. Este archivo conserva el alcance acordado y las comprobaciones pendientes.

## Objetivo

En los teléfonos corporativos con Coffee Fly, el Registrador debe poder identificar sesiones por dispositivo, ver la cuenta y el perfil, conocer la hora de inicio y la última conexión, y revocar el acceso de un equipo perdido. El coordinador y el conductor deben poder iniciar, recibir y contestar llamadas de audio dentro de la aplicación, usar altavoz y activar video durante la llamada para mostrar una situación.

## Implementado en esta rama

- Identificador persistente por instalación en el APK; nombre de modelo y plataforma enviados en el inicio de sesión.
- Historial de sesiones en PostgreSQL con inicio, última conexión, vencimiento y revocación.
- Latido cada 30 segundos mientras la aplicación está activa y conectada.
- Módulo del Registrador con contraseña de confirmación, lista de sesiones y revocación.
- El servidor rechaza inmediatamente el token revocado; el APK borra su sesión al recibir el rechazo.

## Pendiente para completar la misión

- Probar el módulo con al menos dos teléfonos o un teléfono y un emulador, incluida la revocación y la reconexión tras perder Internet.
- Implementar señalización, audio y video en tiempo real entre coordinador y conductor, controles de contestar, colgar, silenciar, altavoz y cámara; probar calidad bajo red móvil y Wi-Fi. Se necesita una infraestructura TURN para llamadas confiables entre redes.
- Añadir aviso de llamada entrante y funcionamiento en segundo plano con las capacidades nativas de Android/iOS.
- Integrar gestión empresarial del dispositivo para desinstalación o borrado remoto. Un APK corriente no dispone de permiso para desinstalarse silenciosamente. La revocación de Coffee Fly funciona cuando el dispositivo recupera conectividad; el borrado del equipo requiere aprovisionamiento Android Enterprise/MDM.
- Verificar que las credenciales de Registrador no sean compartidas con cuentas de conductor o coordinador; la contraseña compartida `Admin123` no constituye una barrera administrativa adecuada.
- Revisar la retención y eliminación de historial de sesiones y registrar auditoría de cada revocación.

## Misión de mapa sin conexión asociada

La rama `offline-map-native-colombia` contiene el mapa vectorial y el APK de prueba. La API pública de Hostless devuelve HTTP 404 en todas las rutas al 13 de octubre de 2026; por eso la prueba con el conductor real está bloqueada. El backend local responde, y se está preparando una compilación de desarrollo para continuar la prueba por USB. No se considera terminado el modo sin conexión hasta comprobar el corredor completo de una ruta activa en el teléfono, cortar Internet y verificar mapa, posición, ruta e instrucciones.
