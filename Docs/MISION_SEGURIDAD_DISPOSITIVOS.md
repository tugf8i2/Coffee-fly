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

El 13 de octubre de 2026 se recuperó la API pública de Hostless y se corrigió la descarga de glifos de MapLibre. En un teléfono Oppo con el APK v5 se inició sesión como conductor, se descargó el corredor de la ruta activa y se verificaron calles, nombres, ruta azul, maniobra y marcador GPS con Wi-Fi y datos desactivados. La app se cerró y volvió a abrir sin Internet; conservó el viaje y la navegación. Tras recuperar la conexión, los puntos GPS capturados durante el corte aparecieron en el servidor sin identificadores duplicados. Está en compilación el APK v6, que usa el mapa descargado también en la vista general de la ruta.
