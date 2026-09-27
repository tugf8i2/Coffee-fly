import {
  devicePosture,
  fuseNavigationHeading,
  navigationSensorLabel,
  normalizeDegrees,
  speedKmhLabel,
} from '../src/servicios/sensoresNavegacion';

describe('sensores de navegación del conductor', () => {
  test('normaliza el rumbo y prioriza el GPS cuando el vehículo avanza', () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(fuseNavigationHeading({ gpsHeading: 370, speedMps: 8, compassHeading: 90, compassAccuracy: 3 }))
      .toEqual({ headingDeg: 10, source: 'gps' });
  });

  test('fusiona brújula y giro por el camino angular corto al ir despacio', () => {
    const result = fuseNavigationHeading({
      gpsHeading: 20,
      speedMps: 0.2,
      compassHeading: 5,
      compassAccuracy: 3,
      previousHeading: 355,
      gyroZDegPerSecond: 10,
      deltaSeconds: 0.2,
    });
    expect(result.source).toBe('fused');
    expect(result.headingDeg).toBeGreaterThan(0);
    expect(result.headingDeg).toBeLessThan(10);
  });

  test('mantiene un rumbo inercial si la brújula no está disponible', () => {
    expect(fuseNavigationHeading({ previousHeading: 90, gyroZDegPerSecond: 20, deltaSeconds: 0.5 }))
      .toEqual({ headingDeg: 100, source: 'gyroscope' });
  });

  test('distingue vertical, horizontal y dispositivo plano con la gravedad', () => {
    expect(devicePosture(0, { x: 0, y: -9, z: 1 })).toBe('vertical');
    expect(devicePosture(90, { x: 9, y: 0, z: 1 })).toBe('horizontal derecha');
    expect(devicePosture(-90, { x: -9, y: 0, z: 1 })).toBe('horizontal izquierda');
    expect(devicePosture(0, { x: 0, y: 0, z: 9.8 })).toBe('plano');
  });

  test('presenta velocidad y estado de sensores sin inventar datos', () => {
    expect(speedKmhLabel(10)).toBe('36 km/h');
    expect(speedKmhLabel(null)).toBe('velocidad pendiente');
    expect(navigationSensorLabel({ active: true, motionAvailable: true, headingSource: 'fused', posture: 'horizontal derecha' }))
      .toBe('GPS + brújula + giroscopio · horizontal derecha');
  });
});
