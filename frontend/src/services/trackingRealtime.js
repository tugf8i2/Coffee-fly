import { API_BASE_URL } from '../config';

const pointKey = (point) => point.client_point_id
  || `${point.latitud}:${point.longitud}:${point.registrada_en}`;

export function mergeTrackingPoints(current = [], incoming = [], limit = 2000) {
  const points = new Map(current.map((point) => [pointKey(point), point]));
  for (const point of incoming) points.set(pointKey(point), point);
  return [...points.values()]
    .sort((first, second) => Date.parse(first.registrada_en) - Date.parse(second.registrada_en))
    .slice(-limit);
}

export function applyTrackingMessage(current, message) {
  if (message.tipo === 'snapshot') return message.seguimiento;
  if (!current) return current;
  if (message.tipo === 'ubicacion') {
    return { ...current, distancia_recorrida_m: message.distancia_recorrida_m ?? current.distancia_recorrida_m, puntos: mergeTrackingPoints(current.puntos, [message.punto]) };
  }
  if (message.tipo === 'ubicaciones') {
    return { ...current, distancia_recorrida_m: message.distancia_recorrida_m ?? current.distancia_recorrida_m, puntos: mergeTrackingPoints(current.puntos, message.puntos || []) };
  }
  return current;
}

export function connectTrackingSocket({ deliveryId, token, onMessage, onStatus }) {
  const socketUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/seguimiento`;
  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let reconnectAttempt = 0;
  let stopped = false;

  const clearTimers = () => {
    clearTimeout(reconnectTimer);
    clearInterval(heartbeatTimer);
  };

  const connect = () => {
    if (stopped || !deliveryId || !token) return;
    onStatus?.('connecting');
    socket = new WebSocket(socketUrl);
    socket.onopen = () => {
      reconnectAttempt = 0;
      onStatus?.('connected');
      socket.send(JSON.stringify({ tipo: 'autenticar', token, entrega_id: deliveryId }));
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ tipo: 'ping' }));
      }, 20000);
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!['ping', 'pong'].includes(message.tipo)) onMessage?.(message);
      } catch {
        onStatus?.('invalid_message');
      }
    };
    socket.onerror = () => onStatus?.('error');
    socket.onclose = (event) => {
      clearTimers();
      if (stopped) return;
      if ([4401, 4403].includes(event.code)) {
        onStatus?.(event.code === 4401 ? 'auth_required' : 'forbidden');
        return;
      }
      reconnectAttempt += 1;
      const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempt - 1, 5)));
      onStatus?.('reconnecting');
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimers();
    socket?.close(1000, 'Pantalla cerrada');
  };
}
