# Servidor cartografico propio

Este perfil sirve un archivo MBTiles vectorial mediante TileServer GL 5.6.0.
Los datos no se versionan porque un extracto nacional puede ocupar varios GB.

## Datos requeridos

Coloca el archivo generado por el pipeline cartografico en:

`infra/tiles/data/coffee-fly-colombia.mbtiles`

Para generarlo desde el extracto oficial de Colombia mediante Planetiler y el
perfil OpenMapTiles 3.16:

```powershell
# Recomendado si C: tiene poco espacio:
.\scripts\prepare-tiles-colombia.ps1 -OutputDirectory 'F:\CoffeeFlyMaps'
```

Después configura `TILESERVER_DATA_DIR=F:/CoffeeFlyMaps` en `.env`. El script
exige al menos 12 GB libres, usa almacenamiento temporal mapeado y no sobrescribe
un archivo existente salvo que se indique `-Force`.

El archivo debe usar un esquema compatible con el estilo que TileServer GL
exponga. OpenMapTiles documenta una generacion reproducible desde datos OSM con
Docker. Deben conservarse la licencia ODbL y la atribucion:

`© OpenMapTiles © OpenStreetMap contributors`

No descargues teselas en masa desde `tile.openstreetmap.org` ni desde la
instancia publica de OpenFreeMap.

## Inicio

```powershell
docker compose -f docker-compose.yml -f docker-compose.tiles.yml --profile maps up -d tile-server frontend
```

TileServer GL genera una pagina de inspeccion en `http://localhost:8081`. El
estilo incluido se llama `coffee-fly`. A traves del proxy de Coffee Fly, su URL
es:

`https://TU_DOMINIO/maps/styles/coffee-fly/style.json`

Usa esa URL como `EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL` al compilar el APK. Debe
ser HTTPS y accesible desde el telefono; `localhost` dentro del APK es el propio
telefono.

En produccion define `TILESERVER_PUBLIC_URL=https://TU_DOMINIO/maps/`. Esa URL
canonica hace que TileServer GL genere correctamente las referencias internas
a teselas, sprites y glifos bajo el subpath y evita confiar en un encabezado
`Host` no validado.

Antes de entregar el servicio valida que el estilo, sprites, glifos y fuentes
de teselas se resuelvan tambien bajo `/maps/`, y realiza la prueba fisica de
modo avion descrita en `Docs/NAVIGATION_OFFLINE.md`.

La configuracion incluida no depende de sprites remotos. Usa las fuentes Noto
Sans empaquetadas en TileServer GL para nombres de vias y lugares, de modo que
el corredor descargado conserve tambien las etiquetas al perder conexion.
