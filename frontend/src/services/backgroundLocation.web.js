export const BACKGROUND_LOCATION_TASK = 'coffee-fly-background-location';

export async function iniciarRastreoSegundoPlano() {
  return {
    background: false,
    reason: 'native_only',
    message: 'El seguimiento GPS de viajes debe iniciarse desde la aplicación móvil.',
  };
}

export async function detenerRastreoSegundoPlano() {}

export async function obtenerEstadoGps() {
  return { taskStarted: false, servicesEnabled: false };
}

export async function procesarLecturaGps() {
  return { accepted: false, quality: { reason: 'GPS móvil no disponible en web.' } };
}
