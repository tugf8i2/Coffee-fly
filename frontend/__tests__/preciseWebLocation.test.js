import { buscarUbicacionPrecisa } from '../src/servicios/ubicacionPrecisaWeb';

describe('adquisición precisa de ubicación web', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const setup = () => {
    let emit;
    const geo = { watchPosition: jest.fn((callback) => { emit = callback; return 7; }), clearWatch: jest.fn() };
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const cancel = buscarUbicacionPrecisa(geo, { onSuccess, onError });
    const point = (accuracy, timestamp = Date.now()) => emit({ timestamp, coords: { latitude: 4.5, longitude: -75.6, accuracy } });
    return { geo, onSuccess, onError, cancel, point };
  };
  test('espera que mejore la primera estimación de red', () => {
    const test = setup();
    test.point(79);
    expect(test.onSuccess).not.toHaveBeenCalled();
    test.point(8);
    expect(test.onSuccess.mock.calls[0][0].coords.accuracy).toBe(8);
    expect(test.geo.clearWatch).toHaveBeenCalledWith(7);
  });
  test('no selecciona una lectura imprecisa al agotar el tiempo', () => {
    const test = setup();
    test.point(79);
    jest.advanceTimersByTime(25000);
    expect(test.onSuccess).not.toHaveBeenCalled();
    expect(test.onError.mock.calls[0][0].message).toContain('79');
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
});
