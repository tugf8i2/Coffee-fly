# Motor de rutas

## Contrato

El cliente solicita la ruta mediante:

`POST /entregas/{entrega_id}/ruta-navegacion`

La salud del subsistema se consulta en `GET /navigation/health`. Una respuesta
`degraded` indica que Coffee Fly sigue vivo pero el proveedor de rutas no está
disponible.

El ajuste remoto de trazas se expone como `POST /navigation/map-match` para
conductores y coordinadores autenticados. Coffee Fly envía la traza a
Valhalla `trace_attributes` o a OSRM Match y devuelve por punto las coordenadas
raw/matched, confianza y distancia a la vía cuando el proveedor la informa.

La API comprueba que el usuario pueda ver la entrega, obtiene el destino
guardado por Coffee Fly y llama al proveedor configurado. La infraestructura
interna no se expone al teléfono.

La respuesta normalizada contiene:

- etapa del viaje y proveedor;
- geometría como pares `latitude`/`longitude`;
- distancia y duración;
- maniobras en español, distancia, duración y coordenada.

## Proveedores

Configurar en el backend:

```dotenv
ROUTING_PROVIDER=valhalla
ROUTING_URL=http://valhalla:8002
ROUTING_TIMEOUT_SECONDS=12
```

También se admite `ROUTING_PROVIDER=osrm`. Valhalla usa Polyline6; OSRM usa
GeoJSON. Ambos se transforman al mismo modelo antes de llegar al frontend.

## Recálculo y fallback

El motor local exige varias lecturas fuera de ruta antes de sugerir un
recálculo. El controlador aplica un cooldown de 30 segundos. Si la conexión o
el proveedor fallan, conserva la copia local en lugar de vaciar la pantalla.

Sin Internet se mantiene la geometría anterior, el destino, el progreso y las
maniobras ya descargadas. El recálculo se vuelve a intentar cuando la API está
alcanzable.

## Perfil rural

La instalación Valhalla puede aprovechar etiquetas OSM de vías terciarias,
superficie y restricciones. Coffee Fly mantiene la abstracción preparada para
ampliar el `costing`, pero el perfil actual es `auto`; todavía no aplica altura,
ancho, peso o ejes a cada petición.
