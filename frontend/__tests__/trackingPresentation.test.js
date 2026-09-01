import { realtimeLabel, trackingModeLabel } from '../src/services/trackingPresentation';

describe('presentación del seguimiento', () => {
  test('traduce todos los estados emitidos por el canal en tiempo real', () => {
    expect(realtimeLabel('connected')).toBe('En vivo');
    expect(realtimeLabel('auth_required')).toBe('Sesión vencida');
    expect(realtimeLabel('forbidden')).toBe('Sin permiso');
    expect(realtimeLabel('error')).toBe('Conexión interrumpida');
    expect(realtimeLabel('invalid_message')).toBe('Respuesta inválida del servidor');
    expect(realtimeLabel('unexpected')).toBe('Estado desconocido');
  });

  test('diferencia Expo Go de un seguimiento nativo en segundo plano', () => {
    expect(trackingModeLabel({ taskStarted: true, deliveryId: '1', runningInExpoGo: false }))
      .toBe('Segundo plano');
    expect(trackingModeLabel({ taskStarted: false, deliveryId: '1', runningInExpoGo: true }))
      .toBe('Primer plano (Expo Go)');
    expect(trackingModeLabel({ taskStarted: false, deliveryId: null, runningInExpoGo: true }))
      .toBe('Detenido');
  });
});
