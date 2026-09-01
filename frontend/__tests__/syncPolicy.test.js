import { classifySyncFailure, retryDelaySeconds } from '../src/services/syncPolicy';

describe('política de sincronización', () => {
  test('aplica espera exponencial con un máximo de quince minutos', () => {
    expect(retryDelaySeconds(1)).toBe(5);
    expect(retryDelaySeconds(2)).toBe(10);
    expect(retryDelaySeconds(3)).toBe(20);
    expect(retryDelaySeconds(99)).toBe(900);
  });

  test('conserva errores GPS permanentes para diagnóstico', () => {
    expect(classifySyncFailure('ubicacion_gps', 422)).toBe('reject');
    expect(classifySyncFailure('ubicacion_gps', 500)).toBe('retry');
  });

  test('distingue sesión expirada, conflicto y payload corrupto', () => {
    expect(classifySyncFailure('ubicacion_gps', 401)).toBe('auth_required');
    expect(classifySyncFailure('estado_entrega', 409)).toBe('conflict');
    expect(classifySyncFailure('solicitud', undefined, true)).toBe('reject');
  });

  test('no reintenta errores permanentes de operaciones generales', () => {
    expect(classifySyncFailure('solicitud', 422)).toBe('reject');
    expect(classifySyncFailure('ubicacion_finca', 403)).toBe('reject');
    expect(classifySyncFailure('estado_entrega', 404)).toBe('reject');
    expect(classifySyncFailure('solicitud', 429)).toBe('retry');
    expect(classifySyncFailure('solicitud', 503)).toBe('retry');
    expect(classifySyncFailure('solicitud', undefined)).toBe('retry');
  });
});
