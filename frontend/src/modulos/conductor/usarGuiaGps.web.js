import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { createNavigationEngine } from '../../servicios/motorNavegacionGps';
import { spanishVoiceCapability } from '../../servicios/navegacionVoz';
import { driverDate } from './presentacionConductor';
import {
  canAdvanceGpsInstruction,
  compactDistance,
  distanceCoordinates,
} from './presentacionGps';

export default function useGpsGuidance({ route, point, visible, enabled }) {
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voice, setVoice] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState('Comprobando voz en español…');
  const engine = useRef(
    createNavigationEngine({ maxAccuracyM: 25, maxAgeMs: 90000 }),
  );
  const previousPoint = useRef(null);
  const progress = useRef({ index: 0, minimum: Infinity });
  const announced = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!active) return;
        const capability = spanishVoiceCapability(voices);
        setVoice(capability.voice);
        setVoiceStatus(capability.label);
      })
      .catch(
        () => active && setVoiceStatus('Voz no disponible en este navegador.'),
      );
    return () => {
      active = false;
      Speech.stop();
    };
  }, [enabled]);
  useEffect(() => {
    engine.current.reset();
    engine.current.setRoute(route?.puntos || []);
    previousPoint.current = null;
    setPosition(null);
    setIndex(0);
    progress.current = { index: 0, minimum: Infinity };
    announced.current = null;
    if (enabled) Speech.stop();
  }, [route, enabled]);
  useEffect(() => {
    if (!enabled || !canAdvanceGpsInstruction(point)) return;
    const time = driverDate(point.registrada_en)?.getTime();
    if (previousPoint.current === time) return;
    previousPoint.current = time;
    const output = engine.current.pushLocation({
      timestamp: time,
      coords: {
        latitude: Number(point.latitud),
        longitude: Number(point.longitud),
        accuracy: Number(point.precision_m),
        speed: point.velocidad_m_s,
        heading: point.rumbo_grados,
      },
    });
    if (output?.accepted) setPosition(output);
  }, [point, route, enabled]);
  const instruction = route?.instrucciones?.[index] || null;
  const raw = canAdvanceGpsInstruction(point)
    ? { latitude: Number(point.latitud), longitude: Number(point.longitud) }
    : null;
  const distance = distanceCoordinates(raw, instruction?.coordenada);
  const speak = useCallback(
    (text) => {
      if (!voice || !voiceEnabled || !text) return;
      Speech.stop();
      Speech.speak(text, {
        language: voice.language,
        voice: voice.identifier,
        rate: 0.95,
        onError: () =>
          setVoiceStatus(
            'No se pudo reproducir la voz. Se mantienen las indicaciones visuales.',
          ),
      });
    },
    [voice, voiceEnabled],
  );
  useEffect(() => {
    if (!enabled || !raw || distance == null || !instruction) return;
    if (progress.current.index !== index)
      progress.current = { index, minimum: distance };
    else
      progress.current.minimum = Math.min(progress.current.minimum, distance);
    if (
      visible &&
      distance <= 300 &&
      announced.current !== index &&
      voiceEnabled &&
      voice
    ) {
      announced.current = index;
      speak(`En ${compactDistance(distance)}, ${instruction.texto}`);
    }
    if (
      distance <= 35 ||
      (progress.current.minimum <= 100 &&
        distance >= progress.current.minimum + 35)
    )
      setIndex((current) => current + 1);
  }, [
    distance,
    index,
    instruction,
    point?.registrada_en,
    visible,
    enabled,
    voiceEnabled,
    voice,
    speak,
  ]);
  useEffect(() => {
    if (enabled && !visible) Speech.stop();
  }, [visible, enabled]);
  const toggleVoice = () => {
    Speech.stop();
    setVoiceEnabled((current) => !current);
  };
  const remaining = position?.remainingRouteM ?? route?.distancia_m;
  const speed =
    Number(route?.distancia_m || 0) /
    Math.max(1, Number(route?.duracion_s || 0));
  return {
    currentInstruction: instruction,
    nextInstruction: route?.instrucciones?.[index + 1] || null,
    turnDistance: distance,
    remainingDistance: remaining,
    remainingDuration:
      remaining != null && speed > 0 ? remaining / speed : route?.duracion_s,
    vehicle: raw ? position?.display || raw : null,
    heading: position?.headingDeg ?? point?.rumbo_grados,
    voiceEnabled,
    voiceStatus,
    toggleVoice,
    repeat: () => speak(instruction?.texto),
  };
}
