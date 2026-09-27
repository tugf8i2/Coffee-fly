export const normalizeDegrees = (value) => ((Number(value) % 360) + 360) % 360;

const validHeading = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const shortestTurn = (from, to) => ((normalizeDegrees(to) - normalizeDegrees(from) + 540) % 360) - 180;

export function fuseNavigationHeading({
  gpsHeading,
  speedMps,
  compassHeading,
  compassAccuracy = 0,
  previousHeading,
  gyroZDegPerSecond,
  deltaSeconds = 0,
} = {}) {
  if (validHeading(gpsHeading) && Number(speedMps) >= 1.5) {
    return { headingDeg: normalizeDegrees(gpsHeading), source: 'gps' };
  }

  let inertial = validHeading(previousHeading) ? normalizeDegrees(previousHeading) : null;
  if (inertial != null && Number.isFinite(Number(gyroZDegPerSecond))) {
    const elapsed = Math.min(0.5, Math.max(0, Number(deltaSeconds) || 0));
    inertial = normalizeDegrees(inertial + Number(gyroZDegPerSecond) * elapsed);
  }

  if (validHeading(compassHeading) && Number(compassAccuracy) > 0) {
    const magnetic = normalizeDegrees(compassHeading);
    if (inertial == null) return { headingDeg: magnetic, source: 'compass' };
    const compassWeight = Number(compassAccuracy) >= 3 ? 0.65 : Number(compassAccuracy) >= 2 ? 0.5 : 0.35;
    return {
      headingDeg: normalizeDegrees(inertial + shortestTurn(inertial, magnetic) * compassWeight),
      source: 'fused',
    };
  }

  if (inertial != null) return { headingDeg: inertial, source: 'gyroscope' };
  if (validHeading(gpsHeading)) return { headingDeg: normalizeDegrees(gpsHeading), source: 'gps' };
  return { headingDeg: null, source: 'unavailable' };
}

export function devicePosture(orientation, gravity = {}) {
  const x = Number(gravity.x) || 0;
  const y = Number(gravity.y) || 0;
  const z = Number(gravity.z) || 0;
  if (Math.abs(z) > Math.max(Math.abs(x), Math.abs(y)) * 1.25 && Math.abs(z) > 6) return 'plano';
  if (orientation === 90) return 'horizontal derecha';
  if (orientation === -90) return 'horizontal izquierda';
  if (Math.abs(orientation) === 180) return 'vertical invertido';
  return 'vertical';
}

export const navigationSensorLabel = (sensor) => {
  if (!sensor?.active) return 'Sensores en espera';
  if (!sensor?.motionAvailable) return 'Sensores de movimiento no disponibles';
  const source = {
    gps: 'rumbo GPS',
    compass: 'brújula',
    fused: 'GPS + brújula + giroscopio',
    gyroscope: 'giroscopio',
  }[sensor.headingSource] || 'rumbo pendiente';
  return `${source} · ${sensor.posture || 'orientación pendiente'}`;
};

export const speedKmhLabel = (speedMps) => speedMps != null && Number.isFinite(Number(speedMps)) && Number(speedMps) >= 0
  ? `${Math.round(Number(speedMps) * 3.6)} km/h`
  : 'velocidad pendiente';
