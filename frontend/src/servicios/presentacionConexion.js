export function connectionLabel(status) {
  if (status === 'online') return 'En línea';
  if (status === 'offline') return 'Sin Internet';
  if (status === 'server_unreachable') return 'Servidor no disponible';
  return 'Comprobando red';
}

export function synchronizationLabel(connectionStatus, synchronizationStatus) {
  if (connectionStatus === 'offline') return 'Esperando Internet';
  if (connectionStatus === 'server_unreachable' || synchronizationStatus === 'offline') {
    return 'Esperando servidor';
  }
  if (synchronizationStatus === 'syncing') return 'Sincronizando';
  if (synchronizationStatus === 'pending') return 'Datos pendientes';
  if (synchronizationStatus === 'auth_required') return 'Requiere iniciar sesión';
  return 'Sincronizado';
}
