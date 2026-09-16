import { alertaVencimiento } from '../src/servicios/alertasDocumentales';

const hoy = new Date('2026-09-16T15:00:00Z');

test('clasifica vencimientos con fecha de Colombia', () => {
  expect(alertaVencimiento(null, hoy)).toBe('Pendiente de registrar');
  expect(alertaVencimiento('2026-09-15', hoy)).toBe('Vencido');
  expect(alertaVencimiento('2026-09-16', hoy)).toBe('Vence en menos de 7 días');
  expect(alertaVencimiento('2026-09-22', hoy)).toBe('Vence en menos de 7 días');
  expect(alertaVencimiento('2026-10-01', hoy)).toBe('Vence en menos de 30 días');
  expect(alertaVencimiento('2026-11-01', hoy)).toBe('Vigente');
});
