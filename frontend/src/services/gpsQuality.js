import * as Crypto from 'expo-crypto';

export const MAX_GPS_ACCURACY_METERS = 150;
export const MAX_GPS_SPEED_METERS_SECOND = 60;

export const canStartTrackingFromGpsResult = (result) => Boolean(result?.quality?.valid);

const toRadians = (value) => value * Math.PI / 180;

export function distanceMeters(first, second) {
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(second.latitud - first.latitud);
  const longitudeDelta = toRadians(second.longitud - first.longitud);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(first.latitud)) * Math.cos(toRadians(second.latitud))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}

const optionalNonNegative = (value) => (
  Number.isFinite(value) && value >= 0 ? Number(value) : null
);

export function createGpsPoint(position) {
  return {
    client_point_id: Crypto.randomUUID(),
    latitud: Number(position.coords.latitude),
    longitud: Number(position.coords.longitude),
    precision_m: optionalNonNegative(position.coords.accuracy),
    velocidad_m_s: optionalNonNegative(position.coords.speed),
    rumbo_grados: optionalNonNegative(position.coords.heading),
    capturada_en: new Date(position.timestamp || Date.now()).toISOString(),
  };
}

export function evaluateGpsPoint(
  point,
  previousPoint,
  { force = false, now = Date.now(), maxAgeMs = 5 * 60 * 1000 } = {},
) {
  if (!Number.isFinite(point.latitud) || point.latitud < -90 || point.latitud > 90
    || !Number.isFinite(point.longitud) || point.longitud < -180 || point.longitud > 180) {
    return { valid: false, shouldStore: false, reason: 'El GPS entregó coordenadas inválidas.' };
  }
  if (!Number.isFinite(point.precision_m)) {
    return { valid: false, shouldStore: false, reason: 'El GPS todavía no informa la precisión.' };
  }
  if (point.precision_m > MAX_GPS_ACCURACY_METERS) {
    return {
      valid: false,
      shouldStore: false,
      reason: `Se descartó un punto impreciso (${Math.round(point.precision_m)} m).`,
    };
  }

  const capturedAt = Date.parse(point.capturada_en);
  if (!Number.isFinite(capturedAt) || capturedAt > now + 2 * 60 * 1000 || capturedAt < now - maxAgeMs) {
    return { valid: false, shouldStore: false, reason: 'Se descartó una lectura GPS desactualizada.' };
  }
  if (point.velocidad_m_s != null && point.velocidad_m_s > MAX_GPS_SPEED_METERS_SECOND) {
    return { valid: false, shouldStore: false, reason: 'Se descartó una velocidad GPS improbable.' };
  }
  if (point.rumbo_grados != null && point.rumbo_grados > 360) {
    return { valid: false, shouldStore: false, reason: 'Se descartó un rumbo GPS inválido.' };
  }
  if (!previousPoint) return { valid: true, shouldStore: true, reason: 'Primer punto válido.' };

  const previousAt = Date.parse(previousPoint.capturada_en);
  const seconds = Math.max(0, (capturedAt - previousAt) / 1000);
  const distance = distanceMeters(previousPoint, point);
  if (seconds <= 20 && distance <= 5) {
    return { valid: true, shouldStore: false, reason: 'Punto repetido.' };
  }
  if (capturedAt <= previousAt) {
    return { valid: false, shouldStore: false, reason: 'Se descartó una lectura GPS fuera de orden.' };
  }
  if (seconds > 0 && distance / seconds > MAX_GPS_SPEED_METERS_SECOND) {
    return { valid: false, shouldStore: false, reason: 'Se descartó un salto GPS físicamente improbable.' };
  }

  const estimatedSpeed = point.velocidad_m_s ?? (seconds > 0 ? distance / seconds : 0);
  const minimumSeconds = estimatedSpeed < 1 ? 60 : estimatedSpeed < 10 ? 30 : 15;
  const minimumDistance = estimatedSpeed < 1 ? 10 : 15;
  if (!force && seconds < minimumSeconds && distance < minimumDistance) {
    return { valid: true, shouldStore: false, reason: 'Esperando movimiento o el siguiente intervalo.' };
  }
  return { valid: true, shouldStore: true, reason: 'Punto GPS válido.' };
}
