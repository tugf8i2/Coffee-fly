# Acta de pruebas físicas GPS — Coffee Fly

Esta acta debe completarse con un **development build/APK**, no únicamente con Expo Go. Expo Go sólo valida ubicación y sincronización mientras la aplicación permanece abierta.

## Preparar el APK de prueba

Desde `frontend`:

```powershell
npx eas-cli login
npx eas-cli whoami
npx eas-cli build --profile development --platform android
```

El inicio de sesión debe hacerlo el propietario directamente; no debe compartir su contraseña ni guardarla en archivos del proyecto. EAS entrega un enlace/QR de descarga cuando termina la compilación. Abra ese enlace en el Android, autorice la instalación de esa fuente sólo para instalar el APK de prueba y luego vuelva a desactivar esa autorización si no la necesita.

El perfil `development` de `frontend/eas.json` ya genera un APK interno con `developmentClient: true`. La compilación en la nube no requiere Android Studio ni `adb`. `adb` sólo es necesario si se quiere instalar por USB o capturar diagnósticos avanzados desde el PC.

Después de instalar el APK, inicie Metro con el modo de development build:

```powershell
npx expo start --dev-client --tunnel --clear
```

No use el QR de Expo Go para F-09 a F-17: ese contenedor no ejecuta la tarea propia de Coffee Fly en segundo plano.

## Dispositivo y entorno

| Campo | Valor |
|---|---|
| Responsable | Pendiente |
| Fecha | Pendiente |
| Marca y modelo | Pendiente |
| Android/iOS y versión | Pendiente |
| Versión de Coffee Fly | 1.0.0 |
| Tipo de build | Development APK / iOS development build |
| Permiso en uso | Pendiente |
| Permiso “siempre” | Pendiente |
| Optimización de batería | Pendiente |
| Red usada | Pendiente |

## Casos obligatorios

En cada caso adjuntar hora inicial/final, captura de pantalla, cantidad de puntos esperados/recibidos y observaciones.

| ID | Caso | Procedimiento | Criterio de aprobación | Resultado |
|---|---|---|---|---|
| F-01 | GPS activo | Iniciar entrega, caminar o conducir 10 minutos | Ruta coherente, timestamps ordenados, precisión visible | Pendiente |
| F-02 | GPS apagado | Desactivar ubicación antes de iniciar | Mensaje claro y aplicación estable | Pendiente |
| F-03 | Permiso denegado | Denegar permiso en uso | No captura; explica cómo recuperarse | Pendiente |
| F-04 | Sólo primer plano | Rechazar “Permitir siempre” | Captura con app abierta y explica la limitación | Pendiente |
| F-05 | Mala precisión | Probar en interior o con señal débil | Punto >150 m rechazado y no suma distancia | Pendiente |
| F-06 | Sin Internet | Activar modo avión durante 15 minutos | GPS continúa; cola pendiente aumenta | Pendiente |
| F-07 | Recuperación de red | Desactivar modo avión | Sincroniza automáticamente, sin duplicados | Pendiente |
| F-08 | API caída | Detener FastAPI durante el recorrido | Conserva puntos y reintenta al volver | Pendiente |
| F-09 | App minimizada | Minimizar durante 15 minutos | Servicio foreground visible y puntos registrados | Pendiente |
| F-10 | Cambio de app | Usar otra app durante 15 minutos | Seguimiento continúa según permisos/SO | Pendiente |
| F-11 | Pantalla apagada | Bloquear pantalla durante 30 minutos | Puntos continúan mientras el SO conserva el servicio | Pendiente |
| F-12 | Ahorro de batería | Activar ahorro del sistema | Intervalos reducidos; no hay cierre inesperado | Pendiente |
| F-13 | Optimización del fabricante | Probar optimizado y “Sin restricciones” | Diferencia documentada; recomendación visible | Pendiente |
| F-14 | Forzar detención | Forzar cierre desde Ajustes | Se documenta que el SO detiene el servicio; reapertura recupera cola | Pendiente |
| F-15 | Reinicio | Reiniciar el celular durante un viaje controlado | No se corrompe la cola; estado recuperable al abrir | Pendiente |
| F-16 | Ocho horas offline | Recorrido o simulación controlada | Cola <50 MB, orden completo y sincronización posterior | Pendiente |
| F-17 | Batería y datos | Medir una hora en movimiento | Consumo registrado y aceptado por el equipo | Pendiente |

## Evidencia preliminar registrada — 1 de septiembre de 2026

El Android con el development APK completó inicio de sesión, conexión WebSocket,
inicio del servicio foreground y el primer tramo de envío. PostgreSQL recibió 4
puntos distintos, ordenados, con precisión entre 9,1 y 33,6 m y 54,7 m de
distancia calculada. No se observaron UUID duplicados.

Esto es una prueba preliminar del flujo completo, no la aprobación de F-01 ni
F-09/F-11: faltan duración, movimiento controlado, confirmación de que la app
estuvo minimizada/pantalla apagada y medición del dispositivo. El monitor de 10
minutos posterior permaneció en 4 puntos, pero sin confirmación de la acción del
usuario se registra como **inconcluso**.

## Medición final

| Métrica | Resultado |
|---|---|
| Puntos capturados | Pendiente |
| Puntos sincronizados | Pendiente |
| Duplicados confirmados | Pendiente |
| Puntos rechazados y motivo | Pendiente |
| Mayor intervalo sin punto | Pendiente |
| Consumo de batería por hora | Pendiente |
| Datos móviles enviados | Pendiente |
| Incidentes/reinicios | Pendiente |

## Monitor de evidencia

Desde `backend`, con la API y PostgreSQL activos, se puede observar un caso sin
exponer coordenadas ni credenciales. Cambia el ID por la entrega de prueba:

```powershell
$env:PYTHONPATH = (Get-Location).Path
python tests/physical_gps_monitor.py `
  --delivery-id d28b7b1e-c68c-4ae2-979a-663a5667ea73 `
  --minutes 10 `
  --label F-09-app-minimizada `
  --output ..\.runtime\F-09-app-minimizada.json
```

Inicia primero el monitor y luego realiza exactamente la acción del caso en el
teléfono. Un resultado `evidence_collected` sólo certifica recepción, unicidad y
orden; la captura de permisos, pantalla/red y modelo del dispositivo sigue siendo
obligatoria para aprobar el caso.

## Aceptación

La prueba física se considera cerrada sólo cuando F-01 a F-17 tienen resultado, evidencia y explicación de cualquier limitación del dispositivo. No se debe afirmar continuidad GPS al 100 %: una detención forzada, permiso revocado o política agresiva del fabricante puede interrumpirla.

Firma responsable: ____________________  Fecha: ____________________
