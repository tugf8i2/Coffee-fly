# Pruebas de navegación

## Automatizadas

```powershell
cd frontend
npm ci
npm test
npx expo-doctor
npx expo export --platform android --output-dir .expo-android-verification
npm run export:web -- --output-dir .expo-web-verification

cd ..\backend
$env:DATABASE_URL='postgresql+psycopg2://postgres:1234@localhost:5433/coffeefly'
python -m pytest -q
python -m alembic heads
```

La cobertura incluye precisión GPS, saltos, suavizado, rumbo, ajuste a ruta,
desviación persistente, recuperación, maniobras, voz, ETA, propiedad de datos,
cifrado, lotes, idempotencia, mapas offline y espacio libre.

Para reproducir lecturas sin desplazarse físicamente, el fixture
`frontend/src/fixtures/gps-test-route.json` puede pasarse a
`createGpsRouteSimulator`. El reproductor permite iniciar, pausar, adelantar,
reiniciar y acelerar la traza manteniendo el mismo contrato de ubicación usado
por el motor.

## Preparación cartográfica

```powershell
.\scripts\prepare-tiles-colombia.ps1 -OutputDirectory 'F:\CoffeeFlyMaps'
$env:TILESERVER_DATA_DIR='F:/CoffeeFlyMaps'
docker compose -f docker-compose.yml -f docker-compose.tiles.yml --profile maps up -d tile-server frontend
```

Configurar el estilo HTTPS resultante en
`EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL` y crear una development build o APK.

## Matriz física obligatoria

1. Asignar viaje, conductor y vehículo reales de prueba.
2. Abrir el viaje con red y preparar el corredor regional.
3. Comprobar mapa, ruta, giro, voz, distancia y ETA.
4. Activar modo avión y verificar que mapa, GPS, maniobras y cola continúen.
5. Desviarse con tres o más puntos fiables y comprobar aviso sin recálculos
   continuos.
6. Recuperar Internet y confirmar recálculo y sincronización sin duplicados.
7. Cerrar y abrir la app sin red; comprobar ruta, progreso reconstruido y cola.
8. Confirmar llegada dentro de la geocerca y visualizar el historial desde el
   coordinador.

Probar al menos una tablet 1280×800 y teléfonos 360×800, 390×844 y 412×915.
Registrar el resultado en `PRUEBAS-FISICAS-GPS.md`.

## Estado actual

Las pruebas automatizadas y exportaciones pasan. La matriz física continúa
pendiente hasta disponer de un teléfono con build nativa y un MBTiles Colombia
servido desde infraestructura alcanzable por el dispositivo.
