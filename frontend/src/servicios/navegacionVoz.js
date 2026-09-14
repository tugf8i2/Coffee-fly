const TYPES = {
  depart: 'Inicia el recorrido',
  arrive: 'Has llegado a tu destino',
  turn: 'Gira',
  continue: 'Continúa',
  'new name': 'Continúa',
  merge: 'Incorpórate',
  fork: 'Toma la bifurcación',
  'on ramp': 'Toma la entrada',
  'off ramp': 'Toma la salida',
  roundabout: 'En la glorieta continúa',
  rotary: 'En la glorieta continúa',
  notification: 'Atención',
  'end of road': 'Al final de la vía gira',
};

const MODIFIERS = {
  left: 'a la izquierda',
  right: 'a la derecha',
  'slight left': 'levemente a la izquierda',
  'slight right': 'levemente a la derecha',
  'sharp left': 'pronunciadamente a la izquierda',
  'sharp right': 'pronunciadamente a la derecha',
  straight: 'recto',
  uturn: 'en U',
};

export const formatDistance = (meters) => {
  const value = Number(meters || 0);
  if (value <= 0) return '0 metros';
  if (value < 1000) return `${Math.max(10, Math.round(value / 10) * 10)} metros`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} kilómetros`;
};

export const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hora${hours === 1 ? '' : 's'}${remainder ? ` y ${remainder} minutos` : ''}`;
};

export function asSpanishInstruction(step) {
  const maneuver = step.maneuver || {};
  const action = TYPES[maneuver.type] || 'Continúa';
  const direction = MODIFIERS[maneuver.modifier] || '';
  const road = step.name ? ` por ${step.name}` : '';
  const exit = maneuver.exit ? ` y toma la salida ${maneuver.exit}` : '';
  const text = `${action}${direction ? ` ${direction}` : ''}${road}${exit}`.trim();
  const location = maneuver.location || [];
  return {
    texto: text,
    distancia_m: Number(step.distance || 0),
    duracion_s: Number(step.duration || 0),
    coordenada: location.length === 2 ? { latitude: Number(location[1]), longitude: Number(location[0]) } : null,
  };
}

export const normalizeRouteInstructions = (instructions = []) => instructions.map((instruction) => (
  typeof instruction === 'string'
    ? { texto: instruction, distancia_m: 0, duracion_s: 0, coordenada: null }
    : instruction
));

export const navigationGreeting = (name, destination, distance, duration) => (
  `Hola ${name || 'conductor'}. Coffee Fly está listo para empezar el viaje. `
  + `Te diriges hacia ${destination || 'el destino seleccionado'}. `
  + `La ruta estimada es de ${formatDistance(distance)} y ${formatDuration(duration)}.`
);
