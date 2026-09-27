import { connectionLabel, syncFeedbackDuration, synchronizationLabel } from '../src/servicios/presentacionConexion';

describe('connection status presentation', () => {
  test('distinguishes loss of Internet from an unavailable API', () => {
    expect(connectionLabel('offline')).toBe('Sin Internet');
    expect(connectionLabel('server_unreachable')).toBe('Servidor no disponible');
  });

  test('never reports synchronized while the API is unreachable', () => {
    expect(synchronizationLabel('server_unreachable', 'synced')).toBe('Esperando servidor');
    expect(synchronizationLabel('online', 'offline')).toBe('Esperando servidor');
  });

  test('shows the active synchronization states', () => {
    expect(synchronizationLabel('online', 'syncing')).toBe('Sincronizando');
    expect(synchronizationLabel('online', 'pending')).toBe('Datos pendientes');
    expect(synchronizationLabel('online', 'synced')).toBe('Sincronizado');
  });

  test('oculta confirmaciones breves sin esconder advertencias', () => {
    expect(syncFeedbackDuration('success')).toBe(3000);
    expect(syncFeedbackDuration('info')).toBe(3000);
    expect(syncFeedbackDuration('warning')).toBe(0);
  });
});
