import { asSpanishInstruction, formatDistance, formatDuration, navigationGreeting, normalizeRouteInstructions, selectSpanishVoice, spanishVoiceCapability } from '../src/servicios/navegacionVoz';

describe('navegación por voz', () => {
  test('traduce maniobras y conserva la calle y coordenada', () => {
    expect(asSpanishInstruction({
      name: 'Carrera 15', distance: 180, duration: 30,
      maneuver: { type: 'turn', modifier: 'right', location: [-75.68, 4.53] },
    })).toEqual({
      texto: 'Gira a la derecha por Carrera 15',
      distancia_m: 180,
      duracion_s: 30,
      coordenada: { latitude: 4.53, longitude: -75.68 },
    });
  });

  test('presenta distancia, duración y saludo en español', () => {
    expect(formatDistance(1530)).toBe('1.5 kilómetros');
    expect(formatDuration(3900)).toBe('1 hora y 5 minutos');
    expect(navigationGreeting('Carlos', 'la cooperativa', 1530, 3900)).toContain('Hola Carlos');
  });

  test('adapta instrucciones guardadas por versiones anteriores', () => {
    expect(normalizeRouteInstructions(['Continúa por la vía'])[0]).toEqual({
      texto: 'Continúa por la vía', distancia_m: 0, duracion_s: 0, coordenada: null,
    });
  });

  test('prefiere español de Colombia y sólo confirma offline si la plataforma lo declara local', () => {
    const voices = [
      { identifier: 'es-mx', language: 'es-MX', quality: 'Enhanced' },
      { identifier: 'es-co', language: 'es-CO', quality: 'Default', localService: true },
    ];
    expect(selectSpanishVoice(voices).identifier).toBe('es-co');
    expect(spanishVoiceCapability(voices)).toMatchObject({ offline: true, voice: { identifier: 'es-co' } });
  });

  test('no promete voz offline cuando la API no expone esa propiedad', () => {
    expect(spanishVoiceCapability([{ identifier: 'es', language: 'es-ES', quality: 'Default' }]).offline).toBeNull();
    expect(spanishVoiceCapability([{ identifier: 'en', language: 'en-US' }]).offline).toBe(false);
  });
});
