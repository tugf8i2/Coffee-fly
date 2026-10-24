# Seguridad y operación

## Controles implementados

- Contraseñas con Argon2id; nunca se guardan en texto plano.
- JWT firmados, con vencimiento, emisor, audiencia y sesión revocable.
- Permisos por rol y autorización contextual de viajes, GPS y llamadas.
- Límite de cuerpo de 6 MB, límites por cliente para API, login y WebSocket.
- Máximo de conexiones WebSocket simultáneas por cliente.
- CORS, hosts permitidos y secretos obligatorios en producción.
- Cabeceras `nosniff`, anti-iframe, política de referencias, permisos y HSTS.
- APK de producción bloquea tráfico HTTP; la excepción HTTP solo existe para
  pruebas locales explícitas (`COFFEE_FLY_LOCAL_TEST=1`).

## Producción en Hostless

Configura como variables privadas de la App:

```text
ENV=production
JWT_SECRET_KEY=<valor aleatorio largo>
CORS_ORIGINS=https://<dominio>
ALLOWED_HOSTS=<dominio>
TRUST_PROXY_HEADERS=true
API_RATE_LIMIT_PER_MINUTE=180
WEBSOCKET_CONNECTIONS_PER_MINUTE=30
WEBSOCKET_CONNECTIONS_PER_CLIENT=5
```

`TRUST_PROXY_HEADERS` solo debe activarse detrás del proxy administrado de
Hostless. No guardes `DATABASE_URL`, claves LiveKit ni contraseñas en Git.

## Distribución Android

Los perfiles `development` y `preview` producen APK para pruebas internas y
Android puede advertir sobre una instalación manual. El perfil `production`
produce un AAB firmado para distribuirse mediante Google Play; no se instala
directamente. Publica la primera versión en la pista de pruebas interna de
Google Play antes de promoverla a producción.

## Alertas y respuesta

Hostless puede enviar una alerta al detectar y otra al recuperar el mismo
incidente. Antes de reiniciar, revisa Logs y despliegues. Para investigar un
5xx, conserva el `X-Request-ID` de la respuesta y consulta los logs JSON.

La instrumentación automática de Hostless no está disponible para la
configuración Docker actual sin un runtime declarado. Para contar con trazas,
incorpora OpenTelemetry en la aplicación y conéctalo a un colector aprobado;
no cambies el runtime solo para habilitar la opción. Las alertas notifican; no
sustituyen un WAF o protección DDoS en el borde. Si el servicio queda expuesto
públicamente, añade esa capa en el proveedor o CDN elegido.

## Límites conocidos

Los límites de API y WebSocket son por proceso. En una futura configuración con
varias réplicas, mueve sus contadores a Redis o a un servicio de borde para que
sean compartidos entre instancias.
