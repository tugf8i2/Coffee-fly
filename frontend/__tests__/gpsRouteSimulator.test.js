import trace from '../src/fixtures/gps-test-route.json';
import { createGpsRouteSimulator } from '../src/servicios/simuladorRutaGps';

describe('simulador de ruta GPS', () => {
  afterEach(() => jest.useRealTimers());

  test('reproduce una traza con el contrato de Location', () => {
    const received = [];
    const simulator = createGpsRouteSimulator(trace, {
      baseTimestamp: 100000,
      onPosition: (point) => received.push(point),
    });

    simulator.step();
    simulator.step();

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({
      timestamp: 100000,
      coords: { latitude: 4.5339, longitude: -75.6811, accuracy: 6 },
    });
    expect(received[1].timestamp).toBe(101000);
    expect(simulator.state()).toMatchObject({ index: 2, total: 8, running: false });
  });

  test('permite acelerar, pausar y reiniciar la reproducción', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-26T12:00:00Z'));
    const received = [];
    const simulator = createGpsRouteSimulator(trace, {
      speed: 10,
      onPosition: (point) => received.push(point),
    });

    simulator.start();
    expect(received).toHaveLength(1);
    jest.advanceTimersByTime(100);
    expect(received).toHaveLength(2);
    simulator.pause();
    jest.advanceTimersByTime(1000);
    expect(received).toHaveLength(2);
    simulator.reset();
    expect(simulator.state().index).toBe(0);
  });
});
