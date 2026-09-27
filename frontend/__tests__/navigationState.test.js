import {
  NAVIGATION_STATES,
  navigationStateLabel,
  navigationStateReducer,
} from '../src/servicios/estadoNavegacion';

describe('máquina de estados de navegación', () => {
  test('recorre preparación, navegación, desvío y recálculo', () => {
    let state = NAVIGATION_STATES.IDLE;
    for (const event of ['PREPARE', 'ROUTE_READY', 'START']) state = navigationStateReducer(state, event);
    expect(state).toBe(NAVIGATION_STATES.NAVIGATING);
    state = navigationStateReducer(state, { type: 'OFF_ROUTE', online: true });
    expect(state).toBe(NAVIGATION_STATES.OFF_ROUTE);
    state = navigationStateReducer(state, 'RECALCULATE');
    expect(state).toBe(NAVIGATION_STATES.RECALCULATING);
    expect(navigationStateReducer(state, 'REROUTED')).toBe(NAVIGATION_STATES.NAVIGATING);
  });

  test('espera conexión al desviarse offline y expone una etiqueta clara', () => {
    const state = navigationStateReducer(NAVIGATION_STATES.NAVIGATING, {
      type: 'OFF_ROUTE', online: false,
    });
    expect(state).toBe(NAVIGATION_STATES.WAITING_FOR_CONNECTION);
    expect(navigationStateLabel(state)).toContain('esperando conexión');
  });
});
