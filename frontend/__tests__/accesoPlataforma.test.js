import { accesoPermitidoEnPlataforma, MENSAJE_CONDUCTOR_SOLO_MOVIL } from '../src/servicios/accesoPlataforma';

test('el conductor solo accede desde Android o iOS', () => {
  expect(accesoPermitidoEnPlataforma('conductor', 'web')).toBe(false);
  expect(accesoPermitidoEnPlataforma('conductor', 'android')).toBe(true);
  expect(accesoPermitidoEnPlataforma('conductor', 'ios')).toBe(true);
  expect(MENSAJE_CONDUCTOR_SOLO_MOVIL).toMatch(/Android y iOS/);
});

test.each(['caficultor', 'coordinador', 'registrador'])('%s accede en web y móvil', (role) => {
  expect(accesoPermitidoEnPlataforma(role, 'web')).toBe(true);
  expect(accesoPermitidoEnPlataforma(role, 'android')).toBe(true);
  expect(accesoPermitidoEnPlataforma(role, 'ios')).toBe(true);
});
