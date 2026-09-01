# Coffee Fly — Expo Go y web

Aplicación React Native (Expo) que usa el mismo backend FastAPI.

1. Instala **Expo Go** desde la tienda del celular.
2. Desde la raíz del proyecto ejecuta el script indicado abajo.
3. Escanea el QR con Expo Go.

Expo Go puede usarse para pruebas rápidas en primer plano, pero no ejecuta las
tareas nativas de ubicación en segundo plano.

El APK de desarrollo anterior permanece archivado en `artifacts/`, pero no es
necesario para el flujo actual. Expo Go incluye el mapa compatible para las
pruebas en primer plano.

### APK nativo archivado

`react-native-maps` necesita una clave habilitada para **Maps SDK for Android**.
Si no existe, Coffee Fly muestra un panel seguro y mantiene GPS, ruta,
sincronización y segundo plano sin montar el mapa, evitando que Android cierre
la pantalla. Para habilitar el mapa en un APK nuevo, configure el secreto de
compilación `GOOGLE_MAPS_ANDROID_API_KEY` en EAS y vuelva a generar el APK. La
clave no debe guardarse en `.env` ni confirmarse en Git.

El teléfono y el PC deben estar en la misma red Wi-Fi. El backend se mantiene en el puerto `8000`.

### Expo Go con `--tunnel`

La forma recomendada en este equipo es ejecutar desde la raíz:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-mobile-tunnel.ps1
```

El script inicia por defecto **Expo Go**. Si en el futuro se retoman las pruebas
de segundo plano con el development client archivado, se puede seleccionar de
forma explícita:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-mobile-tunnel.ps1 -ExpoClient dev-client
```

El script comprueba FastAPI/PostgreSQL, crea el túnel público de la API,
actualiza `frontend/.env` e inicia Expo con un QR. Al pulsar `Ctrl+C` cierra
únicamente los procesos que él mismo creó.

El túnel de Expo sólo permite que el Development Client o Expo Go descarguen el
bundle de Metro (puerto `8081`); no publica FastAPI en el puerto `8000`. Por eso
la app no puede usar una URL privada como `http://localhost:8000` ni una IP local
del PC cuando el celular está fuera de esa red.

En otra terminal, con el backend ya iniciado, publica la API. En este equipo
`cloudflared` está instalado pero no está agregado al `PATH`, por lo que usa
la ruta completa:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000
```

Copie la URL HTTPS que imprime (por ejemplo
`https://mi-api.trycloudflare.com`) en `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=https://mi-api.trycloudflare.com
```

Después inicie o reinicie Expo limpiando la caché:

```powershell
npx expo start --tunnel --go --clear
```

Recargue completamente Expo Go y pruebe primero `https://mi-api.trycloudflare.com/`
en el navegador del celular: debe responder `{"message":"API funcionando"}`.
No use en `.env` la URL que muestra Expo para Metro ni `localhost`.

### Prueba local en el celular y modo offline

Para probar sin servicios de pago, conecta el PC y el celular a la misma red
Wi-Fi. Obtén la IPv4 del PC con `ipconfig` y usa esa dirección en
`frontend/.env` (no `localhost`):

```env
EXPO_PUBLIC_API_URL=http://10.4.246.135:8000
```

Con Docker ejecutándose desde la carpeta raíz del proyecto, inicia Expo en la
carpeta `frontend`:

```powershell
npx expo start --lan --go --clear
```

Esta opción también funciona cuando el router Wi-Fi no tiene salida a Internet:
el PC actúa como servidor local y los teléfonos se comunican con su IPv4. Para
que el seguimiento entre celulares funcione, ambos deben seguir conectados a
esa misma Wi-Fi local.

Para probar el modo offline, inicia sesión una vez con Wi-Fi, registra la
ubicación de finca y, para el conductor, pulsa **Ver y guardar ruta**. Luego
desactiva Wi-Fi y datos móviles: las solicitudes, los cambios de estado, la
ubicación de finca y la ruta ya guardada permanecen en el teléfono. Al volver
a conectarte a la misma red, se sincronizan automáticamente.

La actualización en tiempo real entre teléfonos requiere conexión; sin red no
es técnicamente posible transmitir el GPS a otro dispositivo. En ese caso la
app conserva y muestra la última ruta vial guardada; si no hubo una ruta
previa, muestra la dirección directa al punto de la finca.
