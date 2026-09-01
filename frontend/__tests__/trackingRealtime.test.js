import { applyTrackingMessage, mergeTrackingPoints } from '../src/services/trackingRealtime';

const point = (id, second) => ({
  client_point_id: id,
  latitud: 4.7 + second / 1000,
  longitud: -74.07,
  registrada_en: `2026-08-29T14:00:${String(second).padStart(2, '0')}.000Z`,
});

describe('actualización incremental del seguimiento', () => {
  test('ordena y elimina puntos repetidos por UUID', () => {
    const result = mergeTrackingPoints([point('b', 2), point('a', 1)], [point('b', 2), point('c', 3)]);
    expect(result.map((item) => item.client_point_id)).toEqual(['a', 'b', 'c']);
  });

  test('limita la memoria a los puntos recientes', () => {
    const result = mergeTrackingPoints([point('a', 1), point('b', 2)], [point('c', 3)], 2);
    expect(result.map((item) => item.client_point_id)).toEqual(['b', 'c']);
  });

  test('aplica snapshot y lotes sin reemplazar el resto del seguimiento', () => {
    const snapshot = { tipo: 'snapshot', seguimiento: { vehiculo_placa: 'ABC123', puntos: [point('a', 1)] } };
    const initial = applyTrackingMessage(null, snapshot);
    const updated = applyTrackingMessage(initial, { tipo: 'ubicaciones', puntos: [point('b', 2), point('c', 3)] });
    expect(updated.vehiculo_placa).toBe('ABC123');
    expect(updated.puntos).toHaveLength(3);
  });
});
