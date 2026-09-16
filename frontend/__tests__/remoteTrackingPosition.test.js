import { seleccionarPosicionSeguimiento } from '../src/servicios/posicionSeguimiento';

const now = Date.parse('2026-09-15T12:00:00Z');
const point = (seconds, precision_m = 8, latitud = 4.5) => ({
  latitud, longitud: -75.6, precision_m, registrada_en: new Date(now + seconds * 1000).toISOString(),
});

test('conserva la última ubicación fiable cuando llega GPS de 79 metros', () => {
  const good = point(-10);
  const bad = point(0, 79, 4.5005);
  const result = seleccionarPosicionSeguimiento([good, bad], now);
  expect(result.point).toBe(good);
  expect(result.points).toEqual([good]);
  expect(result.degraded).toBe(true);
  expect(result.status).toContain('imprecisa');
});

test('rechaza saltos imposibles y permite recuperarse con una lectura fiable', () => {
  const recovered = point(0);
  const result = seleccionarPosicionSeguimiento([point(-2), point(-1, 5, 5.5), recovered], now);
  expect(result.points).toHaveLength(2);
  expect(result.point).toBe(recovered);
  expect(result.degraded).toBe(false);
});

test('no inventa posición con precisión desconocida o coordenadas nulas', () => {
  expect(seleccionarPosicionSeguimiento([point(0, null), point(0, 8, null)], now).point).toBeNull();
});

test('marca como antigua la última posición fiable aunque llegue señal mala reciente', () => {
  const result = seleccionarPosicionSeguimiento([point(-120), point(0, 80)], now);
  expect(result.stale).toBe(true);
  expect(result.status).toContain('desactualizada');
});

test('cambiar de viaje sin lecturas no conserva el vehículo anterior', () => {
  seleccionarPosicionSeguimiento([point(0)], now);
  expect(seleccionarPosicionSeguimiento([], now).point).toBeNull();
});

test('no retrocede con mensajes fuera de orden ni acepta puntos del futuro', () => {
  const latest = point(0);
  const result = seleccionarPosicionSeguimiento([point(-10), latest, point(-5), point(60)], now);
  expect(result.point).toBe(latest);
});
