# Misión pendiente: llamadas de Coffee Fly

Objetivo: verificar llamadas de voz y vídeo entre coordinador y conductor cuando uno usa Wi-Fi y el otro datos móviles, y al repetir llamadas sin reiniciar la app.

- [x] Crear acceso LiveKit limitado al viaje y a cada llamada desde el backend.
- [x] Preparar el cliente web que usa la APK para enviar audio y vídeo por LiveKit.
- [ ] Configurar `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` como variables privadas del backend en Hostless. No guardar valores en Git.
- [ ] Probar localmente una llamada en ambos sentidos, varias llamadas consecutivas, apagado y encendido de cámara y recuperación tras cambio de red.
- [ ] Publicar y repetir la prueba con un móvil en Wi-Fi y otro en datos móviles.
- [ ] Verificar que el nombre, el tono, colgar y el estado de cámara se muestran correctamente.
- [ ] Rotar la clave compartida por chat tras la prueba y actualizar el secret privado en Hostless.

La aplicación mantiene el sistema anterior mientras falte alguna variable LiveKit. Las llamadas requieren conexión a Internet; las funciones de datos sin conexión son un trabajo separado.
