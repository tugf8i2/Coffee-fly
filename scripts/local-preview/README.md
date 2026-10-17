# Vista local aislada

Esta vista utiliza `outputs/preview.sqlite3` y las cuentas de prueba `admin@coffeefly.com` y `conductor@coffeefly.com` (clave local `Admin123`). No modifica Hostless ni la base oficial.

1. Desde la raíz del repositorio, ejecuta `python scripts/local-preview/seed.py`.
   Para crear una carga asignada de prueba, ejecuta después `python scripts/local-preview/seed_trip.py`.
2. En una terminal, inicia la API: configura `DATABASE_URL` con la ruta absoluta de `outputs/preview.sqlite3`, configura una `JWT_SECRET_KEY` de desarrollo y ejecuta `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` desde `backend/`.
3. Genera la web con `npm run export:web` desde `frontend/`.
4. Inicia `node scripts/local-preview/server.cjs` desde la raíz; abre `http://127.0.0.1:8080`. El servidor envía `/api/` a la API local.
5. Para una APK de pruebas conectada por USB, usa un paquete Android distinto (`com.coffeefly.mobile.dev`), configura su `EXPO_PUBLIC_APP_URL` como `http://127.0.0.1:8080`, permite HTTP solo en esa compilación y ejecuta `adb reverse tcp:8080 tcp:8080`.

El archivo SQLite y el APK de prueba son artefactos locales; no se publican ni se incluyen en Git.
