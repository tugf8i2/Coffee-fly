# Navegacion offline de Coffee Fly

## Estado implementado

La aplicacion movil conserva durante una perdida de red:

- la sesion local que aun no haya vencido;
- los datos del viaje activo y la geometria de la ruta;
- las maniobras y la guia de voz ya calculadas;
- la posicion GPS y el progreso sobre la ruta;
- los puntos GPS pendientes en SQLite, cifrados con AES-256-GCM;
- el mapa de calles si el conductor preparo previamente el corredor regional.

La cola vuelve a enviar los puntos en lotes al recuperar la API y conserva
`capturada_en`; las claves idempotentes evitan duplicados.

Las novedades reportadas durante el recorrido también entran en la cola local.
Cada una conserva su hora de captura y un identificador único para que los
reintentos automáticos no creen incidentes duplicados.

## Preparar un mapa regional

1. Desplegar un estilo MapLibre y sus teselas desde infraestructura propia o
   contratada que autorice descargas offline. No usar los servidores estandar
   de OpenStreetMap ni el servicio publico de OpenFreeMap para esta tarea.
2. Definir `EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL=https://TU_DOMINIO/maps/styles/coffee-fly/style.json` antes de compilar la app movil.
3. Crear una development build o APK. Expo Go no contiene el modulo nativo de
   MapLibre necesario para los paquetes offline.
4. Con conexion, abrir la ruta del viaje para que Coffee Fly guarde geometria y
   maniobras.
5. Ir a **Perfil > Modo offline** y pulsar **Preparar mapa para offline**.
6. Esperar hasta que la pantalla indique **Listo para usar sin Internet**.

El perfil opcional `docker-compose.tiles.yml` y `infra/tiles/README.md` dejan
preparado TileServer GL para servir un MBTiles propio a traves de `/maps/`.
El script `scripts/prepare-tiles-colombia.ps1` genera ese archivo con Planetiler
y el esquema OpenMapTiles, preferiblemente en una unidad con al menos 12 GB
libres.

Validación local del 26 de septiembre de 2026: se generó
`coffee-fly-colombia.mbtiles` con 725.347 teselas (zoom 0–14, 443.109.376
bytes, SHA-256 `05318375AABFAC11A3E3C69825C691100DBF7F94FB3DEABD1AF9F82372A46288`).
El proxy `/maps/` respondió con estado 200 y tipo Protobuf para el estilo, una
tesela de Bogotá y la fuente Noto Sans. Esta validación comprueba el servidor;
no reemplaza la prueba obligatoria en un teléfono físico.

La aplicacion divide rutas largas en tramos configurables, agrega un corredor
alrededor de cada tramo y estima la cantidad de teselas antes de descargar. Si
la estimacion supera el limite configurado, no inicia la descarga.

La copia local se guarda como un paquete de navegación versionado con viaje,
entrega, etapa, origen, destino, waypoints, geometría, maniobras, distancia,
duración, límites, estilo y estado del paquete cartográfico. Al completar el
mapa se agregan fecha, tamaño, recursos y número de paquetes descargados.

## Configuracion

| Variable | Predeterminado | Funcion |
| --- | ---: | --- |
| `EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL` | vacio | Estilo MapLibre propio. Habilita la descarga. |
| `EXPO_PUBLIC_OFFLINE_MAP_CORRIDOR_KM` | 5 | Margen a cada lado del tramo. |
| `EXPO_PUBLIC_OFFLINE_MAP_SEGMENT_KM` | 20 | Longitud maxima aproximada de cada paquete. |
| `EXPO_PUBLIC_OFFLINE_MAP_MIN_ZOOM` | 9 | Vista general incluida. |
| `EXPO_PUBLIC_OFFLINE_MAP_MAX_ZOOM` | 16 | Detalle maximo descargado. |
| `EXPO_PUBLIC_OFFLINE_MAP_TILE_LIMIT` | 30000 | Limite preventivo por preparacion. |
| `EXPO_PUBLIC_OFFLINE_MAP_ESTIMATED_TILE_KB` | 25 | Promedio conservador usado para estimar espacio. |
| `EXPO_PUBLIC_OFFLINE_MAP_MIN_FREE_MB` | 250 | Reserva que debe quedar libre en el dispositivo. |

El estilo configurado debe usar URLs absolutas alcanzables desde el telefono.
Una URL `localhost` dentro del APK apunta al telefono, no al servidor de Coffee
Fly. En produccion debe usarse HTTPS estable.

## Comportamiento durante el viaje

Al perder la red, `MapaGpsConductor` busca un conjunto completo de paquetes del
propietario, viaje y version de ruta actuales. Si existe, MapLibre renderiza el
mismo corredor desde su base nativa y mantiene encima la ruta, el tramo
recorrido, el vehiculo y el destino. Si no existe o la descarga quedo
incompleta, la app conserva el GPS y muestra una representacion esquematica de
la ruta en lugar de una pantalla vacia.

Los paquetes se asocian al usuario autenticado y a la etapa del viaje. Una
nueva geometria crea una version distinta; la version anterior se elimina solo
despues de terminar correctamente la nueva descarga.

## Limites reales

- El recálculo sobre carreteras nuevas no funciona sin Internet porque el
  grafo Valhalla/OSRM no vive en el dispositivo. La app mantiene la ruta
  anterior, detecta el desvio y recalcula al volver la conexion.
- Los paquetes MapLibre contienen cartografia, no un grafo de routing.
- La captura en segundo plano depende de permisos y restricciones de Android o
  iOS; requiere pruebas fisicas con una build nativa.
- La version web conserva datos operativos, pero no descarga paquetes nativos
  de MapLibre. Su Service Worker conserva el shell y los recursos ya visitados
  para reabrir la PWA sin red, pero el flujo de conductor con calles regionales
  descargadas sigue siendo la app movil instalada.

## Prueba manual obligatoria

1. Preparar una ruta real y completar la descarga regional.
2. Activar modo avion sin cerrar la app.
3. Verificar calles, etiquetas, ruta, marcador y destino.
4. Moverse o usar una traza GPS simulada y comprobar progreso/maniobras.
5. Generar puntos pendientes, reactivar la red y confirmar sincronizacion sin
   duplicados.
6. Cerrar y abrir la app sin red y confirmar recuperacion del viaje y la ruta.
