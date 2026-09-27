export const NAVIGATION_STATES = Object.freeze({
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  READY: 'READY',
  NAVIGATING: 'NAVIGATING',
  OFF_ROUTE: 'OFF_ROUTE',
  WAITING_FOR_CONNECTION: 'WAITING_FOR_CONNECTION',
  RECALCULATING: 'RECALCULATING',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
});

export function navigationStateReducer(state, event) {
  const type = typeof event === 'string' ? event : event?.type;
  switch (type) {
    case 'RESET': return NAVIGATION_STATES.IDLE;
    case 'PREPARE': return NAVIGATION_STATES.PREPARING;
    case 'ROUTE_READY': return NAVIGATION_STATES.READY;
    case 'START': return NAVIGATION_STATES.NAVIGATING;
    case 'OFF_ROUTE': return event?.online === false
      ? NAVIGATION_STATES.WAITING_FOR_CONNECTION
      : NAVIGATION_STATES.OFF_ROUTE;
    case 'RECALCULATE': return NAVIGATION_STATES.RECALCULATING;
    case 'REROUTED': return NAVIGATION_STATES.NAVIGATING;
    case 'ARRIVE': return NAVIGATION_STATES.ARRIVED;
    case 'COMPLETE': return NAVIGATION_STATES.COMPLETED;
    case 'FAIL': return NAVIGATION_STATES.ERROR;
    default: return state;
  }
}

export function navigationStateLabel(state) {
  return {
    IDLE: 'Navegación inactiva',
    PREPARING: 'Preparando navegación',
    READY: 'Ruta preparada',
    NAVIGATING: 'Navegando',
    OFF_ROUTE: 'Fuera de la ruta',
    WAITING_FOR_CONNECTION: 'Fuera de ruta · esperando conexión',
    RECALCULATING: 'Recalculando ruta',
    ARRIVED: 'Destino alcanzado',
    COMPLETED: 'Viaje completado',
    ERROR: 'Navegación con error',
  }[state] || state;
}
