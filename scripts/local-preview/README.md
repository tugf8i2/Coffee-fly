# Vista local aislada

Esta vista utiliza `outputs/preview.sqlite3` y las cuentas de prueba `admin@coffeefly.com`, `coordinador@coffeefly.com` y `conductor@coffeefly.com` (clave local `Admin123`). No modifica Hostless ni la base oficial.

1. Desde la raíz del repositorio, ejecuta `python scripts/local-preview/seed.py`.
   Para crear una carga asignada de prueba, ejecuta después `python scripts/local-preview/seed_trip.py`.
   Para mantener intacta la base que usa el teléfono, define `COFFEE_FLY_PREVIEW_DB` con la ruta absoluta de otra copia SQLite antes de ejecutar ambos scripts.
2. En una terminal, inicia la API: configura `DATABASE_URL` con la ruta absoluta de `outputs/preview.sqlite3`, configura una `JWT_SECRET_KEY` de desarrollo y ejecuta `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` desde `backend/`.
3. Genera la web con `npm run export:web` desde `frontend/`.
4. Inicia `node scripts/local-preview/server.cjs` desde la raíz; abre `http://127.0.0.1:8080`. El servidor envía `/api/` a la API local.
   Para probar llamadas, abre también esa dirección en el navegador del PC con la cuenta de coordinador. El servidor reenvía la conexión WebSocket de señalización; concede permiso de micrófono cuando el navegador lo solicite.
5. Para probar llamadas en la APK, sirve la vista local por HTTPS en la IP del PC accesible desde el teléfono. Android no expone `navigator.mediaDevices.getUserMedia` a una página HTTP por LAN. Genera una CA y un certificado de servidor local con SAN de esa IP, fuera del repositorio. Define `COFFEE_FLY_PREVIEW_HOST`, `COFFEE_FLY_PREVIEW_PORT`, `COFFEE_FLY_PREVIEW_TLS_CERT` y `COFFEE_FLY_PREVIEW_TLS_KEY` para el servidor local. En el build de prueba define `COFFEE_FLY_LOCAL_TEST=1`, `COFFEE_FLY_LOCAL_TEST_CA_CERT` con la CA y `EXPO_PUBLIC_APP_URL=https://IP_DEL_PC:PUERTO`. La configuración Expo incluye esa CA solo en el paquete `com.coffeefly.mobile.dev`; la APK oficial usa su HTTPS público y no incluye la CA local.
6. Mantén otro servidor local por HTTP en `127.0.0.1` para el navegador del coordinador, ambos apuntando a la misma API y base de datos aislada. Inicia sesión en ambas vistas para comprobar nombre, tono y audio. La llamada y el tono requieren que la aplicación esté abierta; esta vista local no implementa notificaciones de llamadas en segundo plano.

El archivo SQLite y el APK de prueba son artefactos locales; no se publican ni se incluyen en Git.
