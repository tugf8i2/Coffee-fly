import { buscarUbicacionPrecisa, validarAccesoUbicacionWeb } from '../src/servicios/ubicacionPrecisaWeb';

describe('adquisición precisa de ubicación web', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const setup = () => {
    let emit; let fail;
    const geo = { watchPosition: jest.fn((callback, errorCallback) => { emit = callback; fail = errorCallback; return 7; }), clearWatch: jest.fn() };
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const cancel = buscarUbicacionPrecisa(geo, { onSuccess, onError });
    const point = (accuracy, timestamp = Date.now()) => emit({ timestamp, coords: { latitude: 4.5, longitude: -75.6, accuracy } });
    return { geo, onSuccess, onError, cancel, point, fail };
  };
  test('espera que mejore la primera estimación de red', () => {
    const test = setup();
    test.point(79);
    expect(test.onSuccess).not.toHaveBeenCalled();
    test.point(8);
    expect(test.onSuccess.mock.calls[0][0].coords.accuracy).toBe(8);
    expect(test.geo.clearWatch).toHaveBeenCalledWith(7);
  });
  test('selecciona automáticamente la mejor lectura disponible aunque sea aproximada', () => {
    const test = setup();
    test.point(79);
    jest.advanceTimersByTime(6000);
    expect(test.onSuccess.mock.calls[0][0].coords.accuracy).toBe(79);
    expect(test.onError).not.toHaveBeenCalled();
  });
  test('conserva la mejor lectura y descarta datos antiguos', () => {
    const test = setup();
    test.point(3, Date.now() - 60000);
    test.point(18);
    test.point(80);
    jest.advanceTimersByTime(25000);
    expect(test.onSuccess.mock.calls[0][0].coords.accuracy).toBe(18);
  });
  test('cancelar impide que la lectura sobrescriba una selección manual', () => {
    const test = setup();
    test.cancel();
    test.point(5);
    jest.advanceTimersByTime(25000);
    expect(test.onSuccess).not.toHaveBeenCalled();
    expect(test.onError).not.toHaveBeenCalled();
  });
  test('traduce el permiso bloqueado y explica cómo recuperarlo', () => {
    const test = setup();
    test.fail({ code: 1, message: 'User denied Geolocation' });
    expect(test.onError.mock.calls[0][0].message).toContain('permiso de ubicación');
    expect(test.onError.mock.calls[0][0].message).toContain('candado');
  });
  test('detecta un permiso previamente bloqueado antes de solicitar GPS', async () => {
    const environment = {
      isSecureContext: true,
      location: { hostname: 'coffee.example' },
      navigator: { geolocation: {}, permissions: { query: jest.fn().mockResolvedValue({ state: 'denied' }) } },
    };
    await expect(validarAccesoUbicacionWeb(environment)).rejects.toThrow('bloqueado para Coffee Fly');
  });
  test('explica que la ubicación web necesita HTTPS', async () => {
    const environment = { isSecureContext: false, location: { hostname: '192.168.1.20' }, navigator: { geolocation: {} } };
    await expect(validarAccesoUbicacionWeb(environment)).rejects.toThrow('HTTPS');
  });
});
