const REALTIME_LABELS = {
  connected: 'En vivo',
  connecting: 'Conectando',
  reconnecting: 'Reconectando',
  auth_required: 'Sesión vencida',
  forbidden: 'Sin permiso',
  disconnected: 'Desconectado',
  error: 'Conexión interrumpida',
  invalid_message: 'Respuesta inválida del servidor',
};

export function realtimeLabel(status) {
  return REALTIME_LABELS[status] || 'Estado desconocido';
}

export function trackingModeLabel({ taskStarted, deliveryId, runningInExpoGo }) {
  if (taskStarted) return 'Segundo plano';
  if (!deliveryId) return 'Detenido';
  return runningInExpoGo
    ? 'Primer plano (Expo Go)'
    : 'Primer plano / segundo plano no iniciado';
}
