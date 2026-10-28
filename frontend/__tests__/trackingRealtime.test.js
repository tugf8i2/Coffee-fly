import { applyTrackingMessage, connectTrackingSocket, mergeTrackingPoints, trackingSocketUrl } from '../src/servicios/seguimientoTiempoReal';

const point = (id, second) => ({
  client_point_id: id,
  latitud: 4.7 + second / 1000,
  longitud: -74.07,
  registrada_en: `2026-08-29T14:00:${String(second).padStart(2, '0')}.000Z`,
});

describe('actualización incremental del seguimiento', () => {
  test('crea WebSocket absoluto desde el proxy relativo del export web', () => {
    expect(trackingSocketUrl('/api', { protocol: 'https:', host: 'coffee.example.com' }))
      .toBe('wss://coffee.example.com/api/ws/seguimiento');
    expect(trackingSocketUrl('https://api.example.com')).toBe('wss://api.example.com/ws/seguimiento');
  });

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

  test('cierra el canal al pasar a segundo plano y lo recupera al volver', () => {
    const previousWebSocket = global.WebSocket;
    const previousAppState = window.__COFFEE_FLY_APP_ACTIVE__;
    const previousAddListener = window.addEventListener;
    const previousRemoveListener = window.removeEventListener;
    const sockets = [];
    let onAppStateChange;
    class FakeSocket {
      constructor() {
        this.readyState = 0;
        sockets.push(this);
      }
      close() {
        this.readyState = 3;
        this.onclose?.({ code: 1000 });
      }
      send() {}
    }
    FakeSocket.OPEN = 1;
    global.WebSocket = FakeSocket;
    window.__COFFEE_FLY_APP_ACTIVE__ = true;
    window.addEventListener = (name, listener) => {
      if (name === 'coffee-fly:app-state') onAppStateChange = listener;
    };
    window.removeEventListener = () => {};
    try {
      const disconnect = connectTrackingSocket({ deliveryId: 1, token: 'test' });
      expect(sockets).toHaveLength(1);
      window.__COFFEE_FLY_APP_ACTIVE__ = false;
      onAppStateChange();
      expect(sockets[0].readyState).toBe(3);
      expect(sockets).toHaveLength(1);
      window.__COFFEE_FLY_APP_ACTIVE__ = true;
      onAppStateChange();
      expect(sockets).toHaveLength(2);
      disconnect();
    } finally {
      global.WebSocket = previousWebSocket;
      window.__COFFEE_FLY_APP_ACTIVE__ = previousAppState;
      window.addEventListener = previousAddListener;
      window.removeEventListener = previousRemoveListener;
    }
  });
});
