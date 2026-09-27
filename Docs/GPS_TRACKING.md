# GPS y tracking

## Captura

La ubicación se obtiene fuera de la interfaz mediante los servicios de
seguimiento y la tarea nativa de segundo plano. Se conservan latitud, longitud,
precisión, velocidad, rumbo y hora original. Los perfiles de actualización
cambian según navegación, segundo plano y batería.

## Calidad y movimiento

El motor de navegación valida:

- coordenadas y antigüedad;
- precisión máxima;
- velocidad reportada;
- saltos físicamente imposibles;
- orden temporal.

Un filtro de posición/velocidad suaviza el movimiento. El rumbo proviene del
GPS cuando es fiable o del vector de movimiento. La posición visible puede
proyectarse sobre la ruta, pero solo cuando distancia, precisión, dirección y
continuidad ofrecen confianza suficiente.

Los parámetros están centralizados en `NAVIGATION_GPS_DEFAULTS` y en la
política de segundo plano; no deben duplicarse dentro de componentes.

## Persistencia sin conexión

Cada punto recibe `client_point_id` y `capturada_en`. En móvil se cifra con
AES-256-GCM y se guarda en SQLite. Al regresar la API se envían lotes de hasta
100 puntos; el servidor conserva la hora capturada y devuelve guardado,
duplicado o rechazado por elemento.

Las colas están separadas por usuario autenticado. Los rechazos permanentes se
conservan para diagnóstico y los errores transitorios usan espera exponencial.

## Coordinador

El detalle usa WebSocket. La vista de flota obtiene posiciones agrupadas y
anima los marcadores entre actualizaciones, evitando sondeo por vehículo cada
segundo.
