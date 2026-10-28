import { API_BASE_URL } from '../configuracion';
import { AppState } from 'react-native';

export function trackingSocketUrl(baseUrl = API_BASE_URL, locationOverride = null) {
  if (/^https?:\/\//i.test(baseUrl)) return `${baseUrl.replace(/^http/i, 'ws')}/ws/seguimiento`;
  const browserLocation = locationOverride || (typeof window !== 'undefined' ? window.location : null);
  if (browserLocation?.host) {
    const protocol = browserLocation.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = `/${String(baseUrl).replace(/^\/+|\/+$/g, '')}`;
    return `${protocol}//${browserLocation.host}${path}/ws/seguimiento`;
  }
  throw new Error('EXPO_PUBLIC_API_URL debe ser una URL absoluta en la aplicación móvil.');
}

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
  const socketUrl = trackingSocketUrl();
  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let reconnectAttempt = 0;
  let stopped = false;
  let blocked = false;
  const isAppActive = () => !['background', 'inactive'].includes(AppState.currentState)
    && (typeof document === 'undefined' || document.visibilityState !== 'hidden')
    && (typeof window === 'undefined' || window.__COFFEE_FLY_APP_ACTIVE__ !== false);
  let appIsActive = isAppActive();

  const clearTimers = () => {
    clearTimeout(reconnectTimer);
    clearInterval(heartbeatTimer);
    reconnectTimer = null;
    heartbeatTimer = null;
  };

  const connect = () => {
    if (stopped || blocked || !appIsActive || socket || !deliveryId || !token) return;
    onStatus?.('connecting');
    const currentSocket = new WebSocket(socketUrl);
    socket = currentSocket;
    currentSocket.onopen = () => {
      if (socket !== currentSocket || !appIsActive) return;
      reconnectAttempt = 0;
      onStatus?.('connected');
      currentSocket.send(JSON.stringify({ tipo: 'autenticar', token, entrega_id: deliveryId }));
      heartbeatTimer = setInterval(() => {
        if (currentSocket === socket && currentSocket.readyState === WebSocket.OPEN)
          currentSocket.send(JSON.stringify({ tipo: 'ping' }));
      }, 20000);
    };
    currentSocket.onmessage = (event) => {
      if (socket !== currentSocket) return;
      try {
        const message = JSON.parse(event.data);
        if (!['ping', 'pong'].includes(message.tipo)) onMessage?.(message);
      } catch {
        onStatus?.('invalid_message');
      }
    };
    currentSocket.onerror = () => {
      if (socket === currentSocket) onStatus?.('error');
    };
    currentSocket.onclose = (event) => {
      if (socket !== currentSocket) return;
      socket = null;
      clearTimers();
      if (stopped || !appIsActive) return;
      if ([4401, 4403].includes(event.code)) {
        blocked = true;
        onStatus?.(event.code === 4401 ? 'auth_required' : 'forbidden');
        return;
      }
      reconnectAttempt += 1;
      const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempt - 1, 5)));
      onStatus?.('reconnecting');
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  const updateActivity = () => {
    const wasActive = appIsActive;
    appIsActive = isAppActive();
    if (wasActive && !appIsActive) {
      clearTimers();
      const currentSocket = socket;
      socket = null;
      currentSocket?.close(1000, 'Aplicación en segundo plano');
      onStatus?.('paused');
    } else if (!wasActive && appIsActive) {
      connect();
    }
  };
  const subscription = AppState.addEventListener('change', updateActivity);
  if (typeof window !== 'undefined') window.addEventListener('coffee-fly:app-state', updateActivity);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', updateActivity);
  connect();
  return () => {
    stopped = true;
    clearTimers();
    socket?.close(1000, 'Pantalla cerrada');
    subscription.remove();
    if (typeof window !== 'undefined') window.removeEventListener('coffee-fly:app-state', updateActivity);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', updateActivity);
  };
}
