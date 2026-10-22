# Misión pendiente: llamadas de Coffee Fly

Objetivo: verificar llamadas de voz y vídeo entre coordinador y conductor cuando uno usa Wi-Fi y el otro datos móviles, y al repetir llamadas sin reiniciar la app.

- [x] Crear acceso LiveKit limitado al viaje y a cada llamada desde el backend.
- [x] Preparar el cliente web que usa la APK para enviar audio y vídeo por LiveKit.
- [x] Guardar `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` como variables privadas de la App en Hostless. Falta validar los valores mediante una sesión real. No guardar valores en Git.
- [ ] Probar localmente una llamada en ambos sentidos, varias llamadas consecutivas, apagado y encendido de cámara y recuperación tras cambio de red.
- [x] Publicar el commit `658d5b8` en `master`: la API nueva responde en el dominio oficial.
- [ ] Repetir la prueba con un móvil en Wi-Fi y otro en datos móviles.
- [ ] Verificar que el nombre, el tono, colgar y el estado de cámara se muestran correctamente.
- [ ] Rotar la clave compartida por chat tras la prueba y actualizar el secret privado en Hostless.

La aplicación mantiene el sistema anterior mientras falte alguna variable LiveKit. Las llamadas requieren conexión a Internet; las funciones de datos sin conexión son un trabajo separado.

Estado al 22 de octubre de 2026: Hostless informó `Deployed / Live` y `GET /api/llamadas/medio` sin sesión devolvió 401, confirmando que la API nueva está activa. La contraseña antigua del coordinador devolvió 401; evitar nuevos intentos hasta usar una sesión o contraseña válida. Sigue pendiente comprobar que el modo autenticado sea `livekit` y realizar llamadas reales.
