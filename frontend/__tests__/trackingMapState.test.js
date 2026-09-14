import { trackingFitKey } from '../src/servicios/presentacionSeguimiento';

test('cambia la clave de ajuste cuando cambia la entrega', () => {
  const destination = { latitude: 4.6, longitude: -74.1 };
  expect(trackingFitKey('entrega-a', destination)).not.toBe(trackingFitKey('entrega-b', destination));
});
