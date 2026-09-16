# Panel del conductor

Diseño integrado en web y Android/iOS a partir de la referencia proporcionada: fondo crema, verde bosque, texto azul oscuro, Roboto Condensed local, ilustraciones originales, tarjetas, insignias de estado y cinco pestañas inferiores. No modifica la apariencia de otros roles.

## Pantallas y datos

- Inicio: saludo del usuario, métricas reales de hoy, esquema de paradas y acciones rápidas.
- Ruta: mapa de calles real y ruta verde; en móvil conserva indicaciones, voz, recálculo, controles y validación GPS.
- Entregas: filtros por estado, cargas reales y aceptación de viajes con la confirmación existente.
- Detalle: dirección de recogida y cooperativa, peso, vehículo y acceso a confirmación GPS. No inventa horarios, teléfonos ni especificaciones de café que la API no expone.
- Checklist: seis comprobaciones manuales, guardadas por usuario, vehículo y día. No sustituye inspección mecánica.
- Novedades: seis categorías visuales conectadas al reporte autenticado existente. No cambia los estados de entrega por reportar un evento.
- Offline: informa si hay una ruta guardada y las capacidades reales. No simula descargas de mapas regionales.
- Perfil: información real, estadísticas y últimos 100 viajes completados/cancelados. `/viajes/mi-historial` solo devuelve el historial del perfil de conductor autenticado; no admite elegir otro conductor.

La descarga regional de mapas, el recálculo offline, los adjuntos fotográficos y la consulta documental siguen pendientes de infraestructura/API. Se indican explícitamente en la interfaz. Los mapas mantienen la atribución legal del proveedor y sus datos reales; no son una imagen estática de la plantilla.

## Verificación

```powershell
cd frontend
npm ci
npm test -- --silent
npm run export:web
npx expo export --platform android --output-dir dist-android-check
```

Las pruebas visuales con datos aislados verifican navegación entre pantallas, checklist persistente, reporte y detalle, historial, descarga efectiva de teselas de calles y ausencia de desbordamiento a 390 px. Las pruebas del backend incluyen el alcance del historial propio.

Para ver la web local se reconstruye el servicio frontend. Al añadir `expo-font` y `react-native-svg`, el cliente nativo requiere una nueva compilación; el export Android comprueba el paquete, no sustituye pruebas de GPS/voz en un celular real.
