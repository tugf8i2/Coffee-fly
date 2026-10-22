# Misión pendiente: llamadas de Coffee Fly

Objetivo: verificar llamadas de voz y vídeo entre coordinador y conductor cuando uno usa Wi-Fi y el otro datos móviles, y al repetir llamadas sin reiniciar la app.

- [x] Crear acceso LiveKit limitado al viaje y a cada llamada desde el backend.
- [x] Preparar el cliente web que usa la APK para enviar audio y vídeo por LiveKit.
- [x] Guardar `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` como variables privadas de la App en Hostless. Falta validar los valores mediante una sesión real. No guardar valores en Git.
- [x] Probar en la publicación oficial llamadas en ambos sentidos, varias llamadas consecutivas y apagado y encendido de cámara.
- [ ] Comprobar recuperación al cambiar de Wi-Fi a datos móviles durante una llamada activa.
- [x] Publicar el commit `658d5b8` en `master`: la API nueva responde en el dominio oficial.
- [x] Repetir tres llamadas web → APK sin reiniciar, con un móvil en Wi-Fi y otro en datos móviles (confirmado por el usuario).
- [x] Verificar nombre, tono y colgar en la llamada APK → web (confirmado por el usuario).
- [x] Comprobar que la cámara se ve en el otro dispositivo al encenderla, apagarla y volverla a encender, con audio continuo (confirmado por el usuario).
- [x] Comprobar una llamada web → APK de 60 segundos con audio continuo en ambos sentidos (confirmado por el usuario).
- [ ] Rotar la clave compartida por chat tras la prueba y actualizar el secret privado en Hostless.

La aplicación mantiene el sistema anterior mientras falte alguna variable LiveKit. Las llamadas requieren conexión a Internet; las funciones de datos sin conexión son un trabajo separado.

Estado al 22 de octubre de 2026: Hostless informó `Deployed / Live` y `GET /api/llamadas/medio` sin sesión devolvió 401, confirmando que la API nueva está activa. La contraseña antigua del coordinador devolvió 401; evitar nuevos intentos hasta usar una sesión o contraseña válida. Sigue pendiente comprobar que el modo autenticado sea `livekit`.

La prueba de audio web → APK y el ciclo de cámara salieron bien con ambos dispositivos en Wi-Fi. También funcionaron tres llamadas web → APK consecutivas entre Wi-Fi y datos móviles. APK → web funcionó con nombre, tono, audio, cámara y colgado en ambos lados. El usuario no puede probar por ahora el cambio de red durante una llamada. Sigue pendiente rotar la clave compartida y actualizarla en Hostless.
