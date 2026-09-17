import {
  createNavigationEngine,
  headingDifference,
  projectPointOnSegment,
  validateNavigationMeasurement,
} from '../src/servicios/motorNavegacionGps';

const baseTime = Date.parse('2026-09-11T12:00:00.000Z');
const position = ({ eastM = 0, northM = 0, seconds = 0, accuracy = 6, speed = 10, heading = 90 } = {}) => ({
  timestamp: baseTime + seconds * 1000,
  coords: {
    latitude: 4.65 + northM / 111195,
    longitude: -74.12 + eastM / (111195 * Math.cos(4.65 * Math.PI / 180)),
    accuracy,
    speed,
    heading,
  },
});

describe('motor GPS de navegación', () => {
  test('rechaza precisión mala y saltos físicamente imposibles', () => {
    const first = { timestampMs: baseTime, latitude: 4.65, longitude: -74.12, accuracyM: 5, speedMps: 0 };
    expect(validateNavigationMeasurement({ ...first, accuracyM: 101 }, null, baseTime).code).toBe('poor-accuracy');
    const jump = { ...first, timestampMs: baseTime + 1000, latitude: 4.66 };
    expect(validateNavigationMeasurement(jump, first, baseTime + 1000).code).toBe('impossible-jump');
  });

  test('calcula correctamente diferencias de rumbo al cruzar el norte', () => {
    expect(headingDifference(359, 1)).toBe(2);
  });

  test('proyecta un punto sobre el segmento vial', () => {
    expect(projectPointOnSegment(
      { east: 40, north: 10 },
      { east: 0, north: 0 },
      { east: 100, north: 0 },
    )).toMatchObject({ east: 40, north: 0, fraction: 0.4, distanceM: 10 });
  });

  test('reduce ruido lateral y ajusta el vehículo a la ruta', () => {
    const engine = createNavigationEngine();
    const route = [position().coords, position({ eastM: 500 }).coords]
      .map(({ latitude, longitude }) => ({ latitude, longitude }));
    engine.setRoute(route);
    let output;
    for (let second = 0; second < 8; second += 1) {
      output = engine.pushLocation(position({ eastM: second * 10, northM: second % 2 ? 8 : -8, seconds: second }), baseTime + second * 1000);
    }
    expect(output.routeStatus).toBe('on-route');
    expect(output.displaySource).toBe('matched');
    expect(Math.abs(output.display.latitude - 4.65)).toBeLessThan(0.00002);
  });

  test('no ajusta a carretera cuando la confianza es baja', () => {
    const engine = createNavigationEngine();
    const route = [position().coords, position({ eastM: 500 }).coords]
      .map(({ latitude, longitude }) => ({ latitude, longitude }));
    engine.setRoute(route);
    let output;
    for (let second = 0; second < 4; second += 1) {
      output = engine.pushLocation(position({ eastM: second * 10, northM: 100, seconds: second }), baseTime + second * 1000);
    }
    expect(output.routeStatus).toBe('off-route');
    expect(output.displaySource).toBe('filtered');
  });

  test('exige dos lecturas buenas para volver a ajustar después de salir de ruta', () => {
    const engine = createNavigationEngine();
    const route = [position().coords, position({ eastM: 500 }).coords]
      .map(({ latitude, longitude }) => ({ latitude, longitude }));
    engine.setRoute(route);
    engine.pushLocation(position(), baseTime);
    engine.pushLocation(position({ eastM: 10, seconds: 1 }), baseTime + 1000);
    for (let second = 2; second <= 5; second += 1) {
      engine.pushLocation(position({ eastM: second * 10, northM: 100, seconds: second, accuracy: 3 }), baseTime + second * 1000);
    }
    const firstRecovery = engine.pushLocation(position({ eastM: 60, seconds: 40, accuracy: 3 }), baseTime + 40000);
    const secondRecovery = engine.pushLocation(position({ eastM: 70, seconds: 41, accuracy: 3 }), baseTime + 41000);
    expect(firstRecovery.routeStatus).toBe('off-route');
    expect(firstRecovery.displaySource).toBe('filtered');
    expect(secondRecovery.routeStatus).toBe('on-route');
    expect(secondRecovery.displaySource).toBe('matched');
  });

  test('limita y detiene la predicción visual', () => {
    const engine = createNavigationEngine();
    const first = engine.pushLocation(position(), baseTime);
    const predicted = engine.predictDisplay(baseTime + 2000);
    expect(predicted.predicted).toBe(true);
    expect(predicted.display.longitude).toBeGreaterThan(first.display.longitude);
    expect(engine.predictDisplay(baseTime + 5000)).toBe(first);
  });

  test('la predicción no fuerza la ruta mientras se adquiere confianza', () => {
    const engine = createNavigationEngine();
    engine.setRoute([position().coords, position({ eastM: 500 }).coords]);
    const first = engine.pushLocation(position({ northM: 8 }), baseTime);
    expect(first.displaySource).toBe('filtered');
    const predicted = engine.predictDisplay(baseTime + 1000);
    expect(predicted.display.latitude).toBeCloseTo(first.display.latitude, 6);
  });

  test('actualiza la predicción en intervalos cortos durante movimiento lento', () => {
    const engine = createNavigationEngine();
    const first = engine.pushLocation(position({ speed: 0.6, heading: 90 }), baseTime);
    const predicted = engine.predictDisplay(baseTime + 100);
    expect(predicted.predicted).toBe(true);
    expect(predicted.display.longitude).toBeGreaterThan(first.display.longitude);
  });

  test('reacciona rápido al rumbo del teléfono después de un giro', () => {
    const engine = createNavigationEngine();
    engine.pushLocation(position({ speed: 10, heading: 90 }), baseTime);
    const afterTurn = engine.pushLocation(
      position({ eastM: 10, northM: 10, seconds: 1, speed: 10, heading: 0 }),
      baseTime + 1000,
    );
    expect(headingDifference(afterTurn.headingDeg, 0)).toBeLessThan(35);
  });

  test('mantiene el rumbo y detiene la predicción cuando el vehículo está quieto', () => {
    const engine = createNavigationEngine();
    engine.pushLocation(position({ speed: 8, heading: 90 }), baseTime);
    const stopped = engine.pushLocation(
      position({ eastM: 8, seconds: 1, speed: 0, heading: 230 }),
      baseTime + 1000,
    );
    expect(stopped.headingDeg).toBe(90);
    expect(engine.predictDisplay(baseTime + 2000).display.longitude - stopped.display.longitude).toBeLessThan(0.00002);
  });
});
