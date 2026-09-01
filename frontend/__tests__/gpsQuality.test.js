import {
  canStartTrackingFromGpsResult,
  distanceMeters,
  evaluateGpsPoint,
} from '../src/services/gpsQuality';

const now = Date.parse('2026-08-29T14:00:00.000Z');
const point = (changes = {}) => ({
  client_point_id: '00000000-0000-4000-8000-000000000001',
  latitud: 4.711,
  longitud: -74.0721,
  precision_m: 12,
  velocidad_m_s: 8,
  rumbo_grados: 90,
  capturada_en: new Date(now).toISOString(),
  ...changes,
});

describe('calidad GPS', () => {
  test('calcula distancia geográfica en metros', () => {
    expect(distanceMeters(point(), point({ latitud: 4.712 }))).toBeCloseTo(111.2, 0);
  });

  test('rechaza coordenadas fuera del planeta', () => {
    expect(evaluateGpsPoint(point({ latitud: 91 }), null, { now }).valid).toBe(false);
  });

  test('rechaza precisión insuficiente', () => {
    const result = evaluateGpsPoint(point({ precision_m: 151 }), null, { now });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('impreciso');
  });

  test('rechaza una lectura vieja en primer plano', () => {
    const old = point({ capturada_en: new Date(now - 6 * 60 * 1000).toISOString() });
    expect(evaluateGpsPoint(old, null, { now }).valid).toBe(false);
  });

  test('permite lotes históricos entregados por el sistema operativo', () => {
    const old = point({ capturada_en: new Date(now - 20 * 60 * 1000).toISOString() });
    expect(evaluateGpsPoint(old, null, { now, maxAgeMs: Number.POSITIVE_INFINITY }).valid).toBe(true);
  });

  test('omite duplicados cercanos en tiempo y espacio', () => {
    const previous = point({ capturada_en: new Date(now - 10 * 1000).toISOString() });
    const result = evaluateGpsPoint(point(), previous, { now });
    expect(result.valid).toBe(true);
    expect(result.shouldStore).toBe(false);
  });

  test('una lectura válida omitida por duplicada todavía permite iniciar el seguimiento', () => {
    expect(canStartTrackingFromGpsResult({
      accepted: false,
      quality: { valid: true, shouldStore: false, reason: 'Punto repetido.' },
    })).toBe(true);
    expect(canStartTrackingFromGpsResult({
      accepted: false,
      quality: { valid: false, shouldStore: false, reason: 'Coordenadas inválidas.' },
    })).toBe(false);
  });

  test('rechaza saltos físicamente imposibles', () => {
    const previous = point({ capturada_en: new Date(now - 5 * 1000).toISOString() });
    const result = evaluateGpsPoint(point({ latitud: 4.811 }), previous, { now });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('salto');
  });

  test('rechaza rumbo inválido y puntos incompatibles con la misma hora', () => {
    expect(evaluateGpsPoint(point({ rumbo_grados: 361 }), null, { now }).valid).toBe(false);
    const previous = point({ latitud: 4.7 });
    const result = evaluateGpsPoint(point(), previous, { now });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('fuera de orden');
  });

  test('reduce escrituras cuando no existe movimiento suficiente', () => {
    const previous = point({ capturada_en: new Date(now - 25 * 1000).toISOString() });
    const result = evaluateGpsPoint(point({ latitud: 4.71103, velocidad_m_s: 0.2 }), previous, { now });
    expect(result.valid).toBe(true);
    expect(result.shouldStore).toBe(false);
  });
});
