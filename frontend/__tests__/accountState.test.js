import { accountStateFromUser, accountStatesByUser } from '../src/services/accountState';

const now = Date.parse('2026-08-29T18:00:00.000Z');

describe('estado de cuentas incluido en el listado', () => {
  test('detecta bloqueo temporal vigente sin una petición adicional', () => {
    expect(accountStateFromUser({
      habilitado: true,
      intentos_fallidos: 5,
      bloqueado_hasta: '2026-08-29T18:10:00.000Z',
    }, now)).toEqual({
      habilitado: true,
      intentos_fallidos: 5,
      bloqueado_temporalmente: true,
    });
  });

  test('ignora bloqueos vencidos y conserva perfiles deshabilitados', () => {
    expect(accountStatesByUser([
      { id_usuario: 7, habilitado: false, bloqueado_hasta: '2026-08-29T17:00:00.000Z' },
    ], now)).toEqual({
      7: { habilitado: false, intentos_fallidos: 0, bloqueado_temporalmente: false },
    });
  });
});
