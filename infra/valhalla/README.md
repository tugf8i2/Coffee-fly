# Valhalla Colombia

Coffee Fly puede calcular las rutas detrás de FastAPI con Valhalla 3.8.3 y el
extracto OSM de Colombia fechado `2026-09-01`. El cliente nunca llama al motor
directamente: `POST /entregas/{id}/ruta-navegacion` valida la sesión y el acceso
al viaje, toma el destino autorizado y normaliza geometría, maniobras, distancia
y duración.

## Preparar e iniciar

Docker descarga el PBF y construye el grafo la primera vez. Reserva de 4 a 8 GB
de RAM y aproximadamente 10 GB de disco; la duración depende del equipo.

```powershell
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d valhalla
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml logs -f valhalla
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up --build -d
```

Comprobación directa:

```powershell
Invoke-RestMethod http://127.0.0.1:8002/status
```

El volumen `valhalla_data` conserva PBF, configuración, bases administrativas,
zonas horarias y grafo. No uses `docker compose down -v` salvo que quieras
eliminar deliberadamente esos datos y reconstruirlos.

## Actualizar datos

Cambia `tile_urls` por otro extracto fechado, prepara un volumen nuevo y
valídalo antes de sustituir el activo. Un archivo PMTiles sirve al mapa, pero no
reemplaza este grafo de navegación. Valhalla no aporta tráfico en vivo sin una
fuente y un proceso adicionales.

Software: Valhalla MIT. Datos: OpenStreetMap/Geofabrik ODbL; conserva la
atribución `© OpenStreetMap contributors` en la interfaz y documentación.
