import { fechaLocal, validarPeriodo, queryPeriodo } from '../src/servicios/periodoReporte';

test('valida fechas reales y un máximo inclusivo de 30 días', () => {
  expect(validarPeriodo('2026-02-30', '2026-03-01')).toBeTruthy();
  expect(validarPeriodo('', '')).toBeTruthy();
  expect(validarPeriodo('2026-09-16', '2026-09-15')).toBeTruthy();
  expect(validarPeriodo('2026-09-01', '2026-09-30')).toBe('');
  expect(validarPeriodo('2026-09-01', '2026-10-01')).toBeTruthy();
  expect(validarPeriodo('2026-09-16', '2026-09-16')).toBe('');
});
test('el período del reporte se conserva al preparar la exportación', () => {
  expect(queryPeriodo({ desde: '2026-09-01', hasta: '2026-09-16' })).toBe('fecha_desde=2026-09-01&fecha_hasta=2026-09-16');
  expect(fechaLocal(new Date(2026, 8, 16, 23))).toBe('2026-09-16');
});
