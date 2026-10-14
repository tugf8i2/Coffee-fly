import {
  devicePosture,
  fuseNavigationHeading,
  headingOnScreen,
  navigationSensorLabel,
  normalizeDegrees,
  speedKmhLabel,
  verticalTurnRate,
} from '../src/servicios/sensoresNavegacion';

describe('sensores de navegación del conductor', () => {
  test('normaliza el rumbo y conserva la orientación del teléfono al avanzar', () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(fuseNavigationHeading({ gpsHeading: 370, speedMps: 8, compassHeading: 90, compassAccuracy: 3 }))
      .toEqual({ headingDeg: 90, source: 'compass' });
    expect(fuseNavigationHeading({ gpsHeading: 90, speedMps: 8, previousHeading: 10, gyroYawDegPerSecond: 20, deltaSeconds: 0.5 }))
      .toEqual({ headingDeg: 20, source: 'gyroscope' });
  });

  test('el puntero apunta hacia la cámara cuando el mapa sigue el rumbo', () => {
    expect(headingOnScreen(90, 90)).toBe(0);
    expect(headingOnScreen(275, 275)).toBe(0);
    expect(headingOnScreen(5, 355)).toBe(10);
    expect(headingOnScreen(90, 0)).toBe(90);
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

  test('proyecta el giro sobre la vertical con el teléfono plano o inclinado', () => {
    expect(verticalTurnRate({ alpha: 0, beta: 0, gamma: 30 }, { x: 0, y: 0, z: -9.8 }, 'android')).toBeCloseTo(-30);
    expect(verticalTurnRate({ alpha: 0, beta: 30, gamma: 0 }, { x: 0, y: -9.8, z: 0 }, 'android')).toBeCloseTo(-30);
    expect(verticalTurnRate({ alpha: 30, beta: 0, gamma: 0 }, { x: -9.8, y: 0, z: 0 }, 'android')).toBeCloseTo(-30);
    expect(verticalTurnRate({ alpha: 0, beta: 0, gamma: 30 }, { x: 0, y: 0, z: 9.8 }, 'android')).toBeCloseTo(30);
    expect(verticalTurnRate({ alpha: 30, beta: 0, gamma: 0 }, { x: 0, y: 0, z: -9.8 }, 'ios')).toBeCloseTo(-30);
  });

  test('una lectura antigua de brújula no cancela el giro nuevo', () => {
    expect(fuseNavigationHeading({ previousHeading: 90, gyroYawDegPerSecond: 40, deltaSeconds: 0.2, compassHeading: 90, compassAccuracy: 3, compassUpdated: false }))
      .toEqual({ headingDeg: 98, source: 'gyroscope' });
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
      .toBe('brújula + giroscopio · horizontal derecha');
  });
});
