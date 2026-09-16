import { validateNavigationMeasurement } from './motorNavegacionGps';

// Solo presentación: el historial original conserva todas las lecturas recibidas.
export function seleccionarPosicionSeguimiento(points = [], now = Date.now()) {
  const accepted = [];
  let previous = null;
  let newestTime = -Infinity;
  let newestRejected = false;
  for (const point of points) {
    const timestampMs = Date.parse(point.registrada_en);
    const measurement = {
      timestampMs,
      latitude: point.latitud == null ? NaN : Number(point.latitud),
      longitude: point.longitud == null ? NaN : Number(point.longitud),
      accuracyM: point.precision_m == null ? NaN : Number(point.precision_m),
      speedMps: point.velocidad_m_s == null ? null : Number(point.velocidad_m_s),
    };
    // Validar historia contra su propia fecha, pero nunca aceptar fechas futuras.
    const valid = measurement.accuracyM >= 0 && measurement.accuracyM <= 25
      && timestampMs <= now + 5000
      && validateNavigationMeasurement(measurement, previous, timestampMs).valid;
    if (Number.isFinite(timestampMs) && timestampMs > newestTime) {
      newestTime = timestampMs;
      newestRejected = !valid;
    }
    if (!valid) continue;
    previous = measurement;
    accepted.push(point);
  }
  const point = accepted.at(-1) || null;
  const stale = point && now - Date.parse(point.registrada_en) > 90000;
  const status = !point ? 'Esperando una ubicación del conductor con precisión de 25 m o mejor.'
    : stale ? 'Ubicación desactualizada: se muestra la última posición fiable.'
      : newestRejected ? 'Señal GPS imprecisa: se conserva la última posición fiable.'
        : `Ubicación actualizada · precisión estimada ±${Math.round(point.precision_m)} m`;
  return { point, points: accepted, status, stale: Boolean(stale), degraded: newestRejected };
}
