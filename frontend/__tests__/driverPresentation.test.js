import { driverDate, driverTodayMetrics } from '../src/modulos/conductor/presentacionConductor';

describe('presentación del conductor', () => {
  test('las fechas PostgreSQL sin zona se interpretan como UTC', () => {
    expect(driverDate('2026-09-16T10:00:00').toISOString()).toBe('2026-09-16T10:00:00.000Z');
    expect(driverDate('2026-09-16T05:00:00-05:00').toISOString()).toBe('2026-09-16T10:00:00.000Z');
    expect(driverDate(null)).toBeNull();
    expect(driverDate('no-fecha')).toBeNull();
  });
  test('cuenta viajes y entregas reales, no confunde recogida con entrega completada', () => {
    const active = { iniciado_en: '2026-09-16T12:00:00Z', estado_viaje: 'en_camino', distancia_recorrida_m: 1800, cargas: [{ carga_recogida_en: '2026-09-16T12:01:00Z' }] };
    const history = [
      { iniciado_en: '2026-09-16T11:00:00Z', completado_en: '2026-09-16T11:55:00Z', estado_viaje: 'completado', distancia_recorrida_m: 12400, cargas: [{}, {}] },
      { iniciado_en: '2026-09-15T11:00:00Z', completado_en: '2026-09-15T11:55:00Z', estado_viaje: 'completado', distancia_recorrida_m: 99000, cargas: [{}] },
    ];
    expect(driverTodayMetrics(active, history, new Date('2026-09-16T15:00:00Z'))).toEqual({ trips: 2, deliveries: 2, km: 14.2 });
  });
  test('sin viajes no inventa métricas', () => {
    expect(driverTodayMetrics(null, [])).toEqual({ trips: 0, deliveries: 0, km: 0 });
  });
});
