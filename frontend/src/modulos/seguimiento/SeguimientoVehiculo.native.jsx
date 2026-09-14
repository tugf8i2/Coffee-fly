import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import MapaAbierto from '../../componentes/mapas/MapaAbierto.native';
import MapaNavegacionAbierto from '../../componentes/mapas/MapaNavegacionAbierto.native';
import RoutePreview from '../../componentes/mapas/VistaPreviaRuta';
import DriverEventReporter from '../../componentes/entregas/ReportadorNovedadConductor';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { RUNNING_IN_EXPO_GO } from '../../configuracion/mapasNativos';
import usePolling from '../../ganchos/usarSondeo';
import {
  detenerRastreoSegundoPlano,
  iniciarRastreoSegundoPlano,
  obtenerEstadoGps,
  procesarLecturaGps,
  suscribirLecturasNavegacion,
} from '../../servicios/ubicacionSegundoPlano';
import { canStartTrackingFromGpsResult } from '../../servicios/calidadGps';
import { estaEnLinea, guardarRutaEntrega, obtenerRutaEntrega } from '../../servicios/sinConexion';
import { styles } from './SeguimientoVehiculo.styles';
import { applyTrackingMessage, connectTrackingSocket } from '../../servicios/seguimientoTiempoReal';
import { canCompleteTrip, realtimeLabel, trackingModeLabel } from '../../servicios/presentacionSeguimiento';
import { asSpanishInstruction, formatDistance, formatDuration, navigationGreeting, normalizeRouteInstructions } from '../../servicios/navegacionVoz';
import { obtenerCalleActual } from '../../servicios/calleActual';
import { createNavigationEngine } from '../../servicios/motorNavegacionGps';
import { OSRM_BASE_URL } from '../../configuracion/osrm';
import { apiErrorMessage } from '../../servicios/mensajesApi';
import { createLatestRequestController } from '../../servicios/controlSolicitudes';

const routeService = `${OSRM_BASE_URL}/route/v1/driving`;
const toCoordinate = (latitud, longitud) => ({ latitude: Number(latitud), longitude: Number(longitud) });
const distanceMeters = (first, second) => {
  if (!first || !second) return null;
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLatitude = toRadians(second.latitude - first.latitude);
  const deltaLongitude = toRadians(second.longitude - first.longitude);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(first.latitude)) * Math.cos(toRadians(second.latitude))
    * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
};
const logGpsStage = (stage, details = {}) => {
  if (__DEV__) console.info(`[Coffee Fly GPS] ${stage}`, details);
};
const maneuverSymbol = (text = '') => {
  const normalized = text.toLowerCase();
  if (normalized.includes('izquierda')) return '↰';
  if (normalized.includes('derecha')) return '↱';
  if (normalized.includes('glorieta')) return '↻';
  if (normalized.includes('llegado')) return '◎';
  return '↑';
};

export default function SeguimientoVehiculo({ go, token, user }) {
  const [delivery, setDelivery] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [route, setRoute] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const [gpsState, setGpsState] = useState(null);
  const [realtimeState, setRealtimeState] = useState('disconnected');
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [navigationStarting, setNavigationStarting] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  const [instructionIndex, setInstructionIndex] = useState(0);
  const [followVehicle, setFollowVehicle] = useState(true);
  const [routeFitRequest, setRouteFitRequest] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentRoad, setCurrentRoad] = useState('Localizando calle actual...');
  const [navigationPosition, setNavigationPosition] = useState(null);
  const [navigationEngine] = useState(() => createNavigationEngine());
  const automaticStartRef = useRef(null);
  const greetingRef = useRef(null);
  const lastVoicePointRef = useRef(null);
  const announcedInstructionRef = useRef(null);
  const maneuverProgressRef = useRef({ index: 0, minimumDistance: Number.POSITIVE_INFINITY });
  const roadLookupRef = useRef({ requestedAt: 0, coordinate: null, id: 0 });
  const rerouteRef = useRef(0);
  const completionRef = useRef(false);
  const deliveryRef = useRef(null);
  const trackingRequestsRef = useRef(null);
  const routeRequestsRef = useRef(null);
  if (!trackingRequestsRef.current) trackingRequestsRef.current = createLatestRequestController();
  if (!routeRequestsRef.current) routeRequestsRef.current = createLatestRequestController();
  const role = String(user?.rol || '').toLowerCase();
  const pickup = tracking?.recoleccion_latitud != null && tracking?.recoleccion_longitud != null
    ? toCoordinate(tracking.recoleccion_latitud, tracking.recoleccion_longitud)
    : null;
  const cooperative = tracking?.cooperativa_latitud != null && tracking?.cooperativa_longitud != null
    ? toCoordinate(tracking.cooperativa_latitud, tracking.cooperativa_longitud)
    : null;
  const destination = tracking?.destino_latitud != null && tracking?.destino_longitud != null
    ? toCoordinate(tracking.destino_latitud, tracking.destino_longitud)
    : null;

  const selectDelivery = useCallback((id) => {
    if (deliveryRef.current !== id) {
      routeRequestsRef.current.invalidate();
      setRoute(null);
      setRouteFitRequest(0);
    }
    deliveryRef.current = id;
    setDelivery(id);
  }, []);

  const loadTracking = useCallback(async (id, apply = true) => {
    const request = trackingRequestsRef.current.start();
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/${id}/seguimiento`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: request.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404 && apply && deliveryRef.current === id) setTracking(null);
        throw Error(apiErrorMessage(data, 'No se pudo obtener la ubicación.'));
      }
      if (apply && trackingRequestsRef.current.isCurrent(request) && deliveryRef.current === id) setTracking(data);
      return trackingRequestsRef.current.isCurrent(request) ? data : null;
    } catch (error) {
      if (!trackingRequestsRef.current.isCurrent(request)) return null;
      throw error;
    }
  }, [token]);

  const refreshGpsState = useCallback(async () => {
    if (role === 'conductor') setGpsState(await obtenerEstadoGps());
  }, [role]);

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (role === 'caficultor') {
        const response = await fetchApi(`${API_BASE_URL}/solicitudes/mis-solicitudes`, { headers });
        const data = await response.json();
        if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudieron consultar tus recolecciones activas.'));
        const available = (data.solicitudes_activas || [])
          .filter((item) => item.entrega_id && item.estado_solicitud === 'en camino')
          .map((item) => ({ ...item, id_entrega: item.entrega_id }));
        if (!available.length) {
          setActiveDeliveries([]);
          selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null);
          setMessage('No hay un vehículo asignado para seguir actualmente.', 'info');
          return;
        }
        setActiveDeliveries(available);
        const selected = available.find((item) => item.id_entrega === deliveryRef.current) || available[0];
        selectDelivery(selected.id_entrega);
        await loadTracking(selected.id_entrega);
        setMessage('');
        return;
      }
      if (role === 'conductor') {
        const response = await fetchApi(`${API_BASE_URL}/viajes/mi-activo`, { headers });
        const rows = await response.json();
        if (!response.ok) {
          if (response.status === 404) {
            setActiveTrip(null); selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null);
            await detenerRastreoSegundoPlano();
          }
          throw Error(apiErrorMessage(rows, 'No se pudo cargar el viaje activo.'));
        }
        const trip = rows[0];
        if (!trip) {
          setActiveTrip(null); selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null);
          await detenerRastreoSegundoPlano();
          await refreshGpsState();
          setMessage('No tienes un viaje en camino. Inícialo desde Recolecciones asignadas.', 'info');
          return;
        }
        setActiveTrip(trip);
        const selected = trip.cargas.find((item) => item.id_entrega === deliveryRef.current && !item.carga_recogida_en)
          || trip.cargas.find((item) => !item.carga_recogida_en)
          || trip.cargas[trip.cargas.length - 1];
        selectDelivery(selected.id_entrega);
        await loadTracking(selected.id_entrega);
        await refreshGpsState();
        setMessage('');
        return;
      }
      const response = await fetchApi(`${API_BASE_URL}/entregas/historial?estado=en%20camino`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo consultar los vehículos en camino.'));
      if (!data.items?.length) {
        setActiveDeliveries([]); selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null);
        setMessage('No hay vehículos en camino actualmente.', 'info');
        return;
      }
      setActiveDeliveries(data.items);
      const selected = data.items.find((item) => item.id_entrega === deliveryRef.current) || data.items[0];
      selectDelivery(selected.id_entrega);
      await loadTracking(selected.id_entrega);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }, [loadTracking, refreshGpsState, role, selectDelivery, token]);

  usePolling(load, 30000);

  useEffect(() => () => {
    trackingRequestsRef.current.invalidate();
    routeRequestsRef.current.invalidate();
  }, []);

  useEffect(() => {
    if (!delivery || !token) return undefined;
    return connectTrackingSocket({
      deliveryId: delivery,
      token,
      onMessage: (event) => {
        if (deliveryRef.current === delivery) setTracking((current) => applyTrackingMessage(current, event));
      },
      onStatus: setRealtimeState,
    });
  }, [delivery, token]);

  useEffect(() => () => { Speech.stop(); }, []);

  useEffect(() => {
    if (role !== 'conductor') return undefined;
    return suscribirLecturasNavegacion((position) => {
      const output = navigationEngine.pushLocation(position);
      if (output.accepted) setNavigationPosition(output);
    });
  }, [navigationEngine, role]);

  useEffect(() => {
    routeRequestsRef.current.invalidate();
    setRoute(null);
    setRouteFitRequest(0);
    navigationEngine.reset();
    setNavigationPosition(null);
    setInstructionIndex(0);
    announcedInstructionRef.current = null;
    maneuverProgressRef.current = { index: 0, minimumDistance: Number.POSITIVE_INFINITY };
  }, [delivery, destination?.latitude, destination?.longitude, navigationEngine, tracking?.etapa_viaje]);

  useEffect(() => {
    if (route?.puntos?.length > 1) navigationEngine.setRoute(route.puntos);
  }, [navigationEngine, route?.puntos]);

  useEffect(() => {
    if (role !== 'conductor') return undefined;
    const timer = setInterval(() => {
      const predicted = navigationEngine.predictDisplay();
      if (predicted?.predicted) setNavigationPosition(predicted);
    }, 50);
    return () => clearInterval(timer);
  }, [navigationEngine, role]);

  const cargarRuta = async (origin, routeDestination = destination, stage = tracking?.etapa_viaje || 'hacia_finca', routeDeliveryId = delivery) => {
    if (!routeDeliveryId || !routeDestination) {
      throw Error(stage === 'hacia_cooperativa'
        ? 'La cooperativa no tiene una ubicación registrada.'
        : 'El caficultor todavía no ha guardado la ubicación de su finca.');
    }
    const routeRequest = routeRequestsRef.current.start();
    const routeKey = `${routeDeliveryId}:${stage}`;
    const saved = await obtenerRutaEntrega(routeKey);
    if (!routeRequestsRef.current.isCurrent(routeRequest)) return null;
    const online = await estaEnLinea();
    if (!routeRequestsRef.current.isCurrent(routeRequest)) return null;
    if (!online) {
      if (saved) {
        const instructions = normalizeRouteInstructions(saved.instrucciones);
        const supportsVoice = instructions.every((instruction) => instruction.coordenada);
        const normalized = { ...saved, instrucciones: supportsVoice ? instructions : [] };
        if (routeRequestsRef.current.isCurrent(routeRequest)) {
          setRoute(normalized);
          setMessage(supportsVoice
            ? 'Sin internet: navegación por voz usando la ruta guardada.'
            : 'Sin internet: mostrando una ruta visual antigua. La voz se reactivará al actualizar la ruta.', 'warning');
        }
        return normalized;
      }
      const directRoute = { puntos: [origin, routeDestination], instrucciones: [], etapa: stage };
      if (routeRequestsRef.current.isCurrent(routeRequest)) {
        setRoute(directRoute);
        setMessage('Sin internet y sin una ruta guardada: se muestra la dirección directa al destino.', 'warning');
      }
      return directRoute;
    }
    try {
      const url = `${routeService}/${origin.longitude},${origin.latitude};${routeDestination.longitude},${routeDestination.latitude}?overview=full&geometries=geojson&steps=true`;
      const controller = new AbortController();
      const abortObsoleteRoute = () => controller.abort();
      routeRequest.signal.addEventListener('abort', abortObsoleteRoute, { once: true });
      const timer = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
        routeRequest.signal.removeEventListener('abort', abortObsoleteRoute);
      }
      const data = await response.json();
      if (!routeRequestsRef.current.isCurrent(routeRequest)) return null;
      const first = data.routes?.[0];
      if (!response.ok || !first?.geometry?.coordinates?.length) {
        throw Error('No se encontró una ruta vial para estas coordenadas.');
      }
      const next = {
        etapa: stage,
        puntos: first.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
        instrucciones: (first.legs || [])
          .flatMap((leg) => leg.steps || [])
          .map(asSpanishInstruction)
          .filter((instruction) => instruction.texto),
        distancia_m: Number(first.distance || 0),
        duracion_s: Number(first.duration || 0),
        calculada_en: Date.now(),
      };
      if (JSON.stringify(next).length <= 1024 * 1024) await guardarRutaEntrega(routeKey, next);
      if (!routeRequestsRef.current.isCurrent(routeRequest)) return null;
      setRoute(next);
      setMessage('Ruta vial cargada y guardada para usarla también sin internet.', 'success');
      return next;
    } catch (error) {
      if (!routeRequestsRef.current.isCurrent(routeRequest)) return null;
      if (saved) {
        const instructions = normalizeRouteInstructions(saved.instrucciones);
        const supportsVoice = instructions.every((instruction) => instruction.coordenada);
        const normalized = { ...saved, instrucciones: supportsVoice ? instructions : [] };
        setRoute(normalized);
        setMessage(supportsVoice
          ? 'No se pudo actualizar la ruta; continúa la navegación con la copia guardada.'
          : 'Se muestra una ruta visual antigua; las indicaciones habladas requieren conexión para actualizarla.', 'warning');
        return normalized;
      }
      const directRoute = { puntos: [origin, routeDestination], instrucciones: [], etapa: stage };
      setRoute(directRoute);
      setMessage(error.name === 'AbortError'
        ? 'El servicio de rutas tardó demasiado; se muestra la dirección directa al destino.'
        : error.message);
      return directRoute;
    }
  };

  const obtainCurrentPosition = async ({ allowLastKnown = true, timeoutMs = 15000 } = {}) => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    logGpsStage('servicios_consultados', { enabled: servicesEnabled });
    if (!servicesEnabled) {
      throw Error('Activa la ubicación del celular antes de iniciar el GPS.');
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    logGpsStage('permiso_primer_plano', { status: permission.status });
    if (permission.status !== 'granted') {
      throw Error('Debes permitir la ubicación precisa mientras usas Coffee Fly.');
    }
    let timeoutId;
    try {
      return await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(Error('GPS_TIMEOUT')), timeoutMs);
        }),
      ]);
    } catch {
      logGpsStage('lectura_actual_no_disponible');
      if (!allowLastKnown) {
        throw Error(`El GPS no entregó una ubicación nueva en ${Math.round(timeoutMs / 1000)} segundos. Sal a un lugar despejado e inténtalo de nuevo.`);
      }
      const saved = await Location.getLastKnownPositionAsync({ maxAge: 30000, requiredAccuracy: 100 });
      if (!saved) {
        throw Error(`El GPS no entregó una lectura en ${Math.round(timeoutMs / 1000)} segundos. Activa la ubicación precisa, sal a un lugar despejado e inténtalo de nuevo.`);
      }
      logGpsStage('ultima_lectura_recuperada');
      return saved;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const confirmPickup = async () => {
    if (!delivery || !pickup) return setMessage('No hay un punto de recolección válido.');
    if (!cooperative) return setMessage('La entrega no tiene una cooperativa de destino con ubicación.');
    if (confirmingPickup) return;
    setConfirmingPickup(true);
    try {
      setMessage('Verificando tu ubicación en el punto de recolección…', 'info');
      const current = await obtainCurrentPosition();
      const origin = toCoordinate(current.coords.latitude, current.coords.longitude);
      const distance = distanceMeters(origin, pickup);
      const confirmationRadius = Number(tracking?.radio_confirmacion_m || 250);
      if (distance == null || distance > confirmationRadius) {
        throw Error(`Debes estar a menos de ${confirmationRadius} m del caficultor. Distancia actual: ${Math.round(distance || 0)} m.`);
      }
      await procesarLecturaGps(delivery, current, token, { force: true });
      const response = await fetchApi(`${API_BASE_URL}/entregas/${delivery}/confirmar-carga`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(result, 'No se pudo confirmar la recogida de la carga.'));
      setRoute(null);
      const remainingLoad = activeTrip?.cargas.find((item) => item.id_entrega !== delivery && !item.carga_recogida_en);
      setActiveTrip((current) => current ? {
        ...current,
        cargas: current.cargas.map((item) => item.id_entrega === delivery
          ? { ...item, carga_recogida_en: result.carga_recogida_en }
          : item),
      } : current);
      if (remainingLoad) {
        const nextTracking = await loadTracking(remainingLoad.id_entrega, false);
        if (!nextTracking) return;
        if (nextTracking.destino_latitud == null || nextTracking.destino_longitud == null) {
          throw Error('La siguiente finca no tiene una ubicación registrada.');
        }
        selectDelivery(remainingLoad.id_entrega);
        setTracking(nextTracking);
        setMessage('Carga confirmada. Continúa hacia la siguiente finca.', 'success');
      } else {
        const updated = await loadTracking(delivery);
        if (!updated) return;
        const nextDestination = toCoordinate(updated.cooperativa_latitud, updated.cooperativa_longitud);
        await cargarRuta(origin, nextDestination, 'hacia_cooperativa');
        setMessage('Todas las cargas fueron recogidas. Continúa hacia la cooperativa.', 'success');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setConfirmingPickup(false);
    }
  };

  const startGps = async () => {
    if (navigationStarting) return;
    logGpsStage('inicio_solicitado', { hasDelivery: Boolean(delivery), hasDestination: Boolean(destination) });
    if (!delivery) return setMessage('Primero carga una entrega asignada.');
    if (!tracking) return setMessage('Espera a que termine de cargar la entrega antes de iniciar el GPS.');
    if (!destination) return setMessage(tracking?.etapa_viaje === 'hacia_cooperativa'
      ? 'La cooperativa debe tener coordenadas para continuar el viaje.'
      : 'La finca debe tener coordenadas antes de iniciar el viaje.');
    try {
      setNavigationStarting(true);
      setNavigationError('');
      setMessage('Buscando una ubicación GPS precisa…', 'info');
      const current = await obtainCurrentPosition();
      logGpsStage('lectura_inicial_obtenida', { hasAccuracy: current?.coords?.accuracy != null });
      const origin = toCoordinate(current.coords.latitude, current.coords.longitude);
      if (tracking?.estado_entrega === 'pendiente') {
        const response = await fetchApi(`${API_BASE_URL}/entregas/${delivery}/estado`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado_entrega: 'en camino', modificado_en: new Date().toISOString() }),
        });
        const data = await response.json();
        if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo iniciar el viaje.'));
        await loadTracking(delivery);
      }
      const navigationRoute = await cargarRuta(origin);
      const initial = await procesarLecturaGps(delivery, current, token, { force: true });
      logGpsStage('lectura_inicial_procesada', { accepted: initial.accepted, reason: initial.quality?.reason || null });
      // Una lectura válida puede omitirse por ser igual al último punto. Eso evita
      // duplicados, pero no debe impedir reactivar el servicio de seguimiento.
      if (!canStartTrackingFromGpsResult(initial)) {
        throw Error(initial.quality?.reason || 'El GPS no entregó una lectura válida.');
      }
      const mode = await iniciarRastreoSegundoPlano(delivery, token, { requestBackground: true });
      logGpsStage('rastreo_iniciado', { background: mode.background, batteryOptimization: mode.batteryOptimization });
      await refreshGpsState();
      if (mode.background) {
        const batteryWarning = mode.batteryOptimization
          ? ' Android tiene optimización de batería activa; usa “Sin restricciones” para mayor continuidad.'
          : '';
        setMessage(`GPS activo en segundo plano.${batteryWarning}`, 'success');
      } else {
        setMessage(mode.message, 'warning');
      }
      const greetingKey = `${activeTrip?.id_viaje}:${delivery}:${tracking?.etapa_viaje}`;
      if (voiceEnabled && greetingRef.current !== greetingKey) {
        greetingRef.current = greetingKey;
        setInstructionIndex(0);
        announcedInstructionRef.current = 0;
        maneuverProgressRef.current = { index: 0, minimumDistance: Number.POSITIVE_INFINITY };
        await Speech.stop();
        Speech.speak(navigationGreeting(
          user?.nombre || user?.nombre_usuario,
          tracking?.destino,
          navigationRoute?.distancia_m,
          navigationRoute?.duracion_s,
        ), { language: 'es-CO', rate: 0.92, pitch: 1 });
        const firstInstruction = navigationRoute?.instrucciones?.[0];
        if (firstInstruction?.texto) Speech.speak(firstInstruction.texto, { language: 'es-CO', rate: 0.92 });
      }
    } catch (error) {
      setMessage(error.message);
      setNavigationError(error.message);
    } finally {
      setNavigationStarting(false);
    }
  };

  useEffect(() => {
    const key = `${activeTrip?.id_viaje || ''}:${delivery || ''}:${tracking?.etapa_viaje || ''}`;
    if (role !== 'conductor' || !activeTrip || !delivery || tracking?.entrega_id !== delivery || !destination || automaticStartRef.current === key) return;
    automaticStartRef.current = key;
    startGps();
  }, [activeTrip?.id_viaje, delivery, destination?.latitude, destination?.longitude, role, tracking?.etapa_viaje]);

  const retryNavigation = () => {
    automaticStartRef.current = null;
    setNavigationError('');
    startGps();
  };

  const allLoadsPicked = canCompleteTrip(activeTrip?.cargas);
  const confirmTripCompletion = () => new Promise((resolve) => Alert.alert(
    'Completar viaje',
    '¿Confirmas que entregaste todas las cargas en la cooperativa?',
    [
      { text: 'Volver', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Completar viaje', onPress: () => resolve(true) },
    ],
    { cancelable: true, onDismiss: () => resolve(false) },
  ));
  const completeTrip = async () => {
    if (!activeTrip || !allLoadsPicked || completionRef.current || !(await confirmTripCompletion())) return;
    completionRef.current = true;
    setCompletingTrip(true);
    try {
      setMessage('Obteniendo una ubicación GPS nueva para verificar la llegada…', 'info');
      const current = await obtainCurrentPosition({ allowLastKnown: false });
      const gpsResult = await procesarLecturaGps(delivery, current, token, { force: true });
      if (!canStartTrackingFromGpsResult(gpsResult)) {
        throw Error(gpsResult.quality?.reason || 'La ubicación GPS nueva no es válida para completar el viaje.');
      }
      const response = await fetchApi(`${API_BASE_URL}/viajes/${activeTrip.id_viaje}/completar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo completar el viaje.'));
      await detenerRastreoSegundoPlano();
      setActiveTrip(null); setTracking(null); selectDelivery(null); trackingRequestsRef.current.invalidate();
      setMessage('Viaje completado. El vehículo quedó disponible para su siguiente asignación.', 'success');
    } catch (error) { setMessage(error.message); }
    finally { completionRef.current = false; setCompletingTrip(false); }
  };

  const points = tracking?.puntos || [];
  const last = points[points.length - 1];
  const rawVehicle = last ? toCoordinate(last.latitud, last.longitud) : null;
  const vehicle = role === 'conductor' && navigationPosition?.display ? navigationPosition.display : rawVehicle;
  const exactVehicle = role === 'conductor' && navigationPosition?.raw ? navigationPosition.raw : rawVehicle;
  const vehicleHeading = role === 'conductor' && navigationPosition?.headingDeg != null
    ? navigationPosition.headingDeg : last?.rumbo_grados;
  const vehicleTimestamp = navigationPosition?.timestampMs || (last ? Date.parse(last.registrada_en) : null);
  const distanceToPickup = distanceMeters(exactVehicle, pickup);
  const displayedRoute = route?.puntos || points.map((point) => toCoordinate(point.latitud, point.longitud));
  const pendingGps = gpsState?.synchronization?.gpsPendientes || 0;
  const trackingMode = trackingModeLabel({
    taskStarted: gpsState?.taskStarted,
    deliveryId: gpsState?.tracking?.deliveryId,
    runningInExpoGo: RUNNING_IN_EXPO_GO,
  });
  const lastAgeSeconds = vehicleTimestamp ? Math.max(0, (Date.now() - vehicleTimestamp) / 1000) : null;
  const canConfirmPickup = tracking?.estado_entrega === 'en camino'
    && !tracking?.carga_recogida_en
    && distanceToPickup != null
    && distanceToPickup <= Number(tracking?.radio_confirmacion_m || 250)
    && lastAgeSeconds <= 300;
  const locationFreshness = lastAgeSeconds == null
    ? 'Sin ubicación'
    : lastAgeSeconds <= 90 ? 'Actualizada' : `Desactualizada (${Math.round(lastAgeSeconds / 60)} min)`;
  const currentInstruction = route?.instrucciones?.[instructionIndex] || null;

  useEffect(() => {
    if (!vehicle || !currentInstruction?.coordenada || !vehicleTimestamp || navigationPosition?.predicted) return;
    if (lastVoicePointRef.current === vehicleTimestamp) return;
    lastVoicePointRef.current = vehicleTimestamp;
    const distance = distanceMeters(vehicle, currentInstruction.coordenada);
    if (distance == null) return;
    if (maneuverProgressRef.current.index !== instructionIndex) {
      maneuverProgressRef.current = { index: instructionIndex, minimumDistance: distance };
    } else {
      maneuverProgressRef.current.minimumDistance = Math.min(maneuverProgressRef.current.minimumDistance, distance);
    }
    if (voiceEnabled && distance <= 300 && announcedInstructionRef.current !== instructionIndex) {
      announcedInstructionRef.current = instructionIndex;
      Speech.speak(`En ${formatDistance(distance)}, ${currentInstruction.texto}`, { language: 'es-CO', rate: 0.92 });
    }
    const passedManeuver = maneuverProgressRef.current.minimumDistance <= 100
      && distance >= maneuverProgressRef.current.minimumDistance + 35;
    if (distance <= 35 || passedManeuver) setInstructionIndex((current) => current + 1);
  }, [currentInstruction, navigationPosition?.predicted, vehicle?.latitude, vehicle?.longitude, vehicleTimestamp, voiceEnabled]);

  useEffect(() => {
    if (!vehicle || role !== 'conductor') return;
    const previous = roadLookupRef.current;
    const moved = distanceMeters(previous.coordinate, vehicle);
    if (Date.now() - previous.requestedAt < 20000 || (moved != null && moved < 50)) return;
    const requestId = previous.id + 1;
    roadLookupRef.current = { requestedAt: Date.now(), coordinate: vehicle, id: requestId };
    obtenerCalleActual(vehicle.latitude, vehicle.longitude).then((road) => {
      if (roadLookupRef.current.id === requestId) setCurrentRoad(road || 'Vía sin nombre registrado');
    }).catch(() => {
      if (roadLookupRef.current.id === requestId) setCurrentRoad('Calle no disponible');
    });
  }, [role, vehicle?.latitude, vehicle?.longitude]);

  useEffect(() => {
    if (!navigationPosition?.rerouteSuggested || !vehicle || !destination) return;
    if (Date.now() - rerouteRef.current < 30000) return;
    rerouteRef.current = Date.now();
    cargarRuta(vehicle, destination, tracking?.etapa_viaje, delivery).then(() => {
      setInstructionIndex(0);
      announcedInstructionRef.current = null;
      maneuverProgressRef.current = { index: 0, minimumDistance: Number.POSITIVE_INFINITY };
      setMessage('Ruta recalculada después de detectar una salida del recorrido.', 'warning');
    }).catch((error) => setMessage(error.message));
  }, [delivery, destination?.latitude, destination?.longitude, navigationPosition?.rerouteSuggested, tracking?.etapa_viaje, vehicle?.latitude, vehicle?.longitude]);

  const nextInstruction = route?.instrucciones?.[instructionIndex + 1] || null;
  const allInstructions = route?.instrucciones || [];
  const remainingInstructions = allInstructions.slice(instructionIndex);
  const currentTurnDistance = distanceMeters(vehicle, currentInstruction?.coordenada);
  const routeCompleted = allInstructions.length > 0 && instructionIndex >= allInstructions.length;
  const stepsDistance = routeCompleted ? 0 : allInstructions.length
    ? remainingInstructions.reduce((total, instruction) => total + Number(instruction.distancia_m || 0), 0)
    : Number(route?.distancia_m || 0);
  const stepsDuration = routeCompleted ? 0 : allInstructions.length
    ? remainingInstructions.reduce((total, instruction) => total + Number(instruction.duracion_s || 0), 0)
    : Number(route?.duracion_s || 0);
  const approachDistance = instructionIndex > 0 ? Number(currentTurnDistance || 0) : 0;
  const routeSpeed = Number(route?.distancia_m || 0) / Math.max(1, Number(route?.duracion_s || 0));
  const engineRemainingDistance = navigationPosition?.remainingRouteM;
  const remainingDistance = engineRemainingDistance != null ? engineRemainingDistance : stepsDistance + approachDistance;
  const remainingDuration = engineRemainingDistance != null && routeSpeed > 0
    ? engineRemainingDistance / routeSpeed
    : stepsDuration + (routeSpeed > 0 ? approachDistance / routeSpeed : 0);
  const arrivalTime = new Date(Date.now() + remainingDuration * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (role === 'conductor' && tracking) return <View style={styles.navigationScreen}>
    <MapaNavegacionAbierto
      style={styles.navigationMap}
      route={displayedRoute}
      vehicle={vehicle}
      vehicleDescription={exactVehicle ? `GPS exacto ${exactVehicle.latitude.toFixed(6)}, ${exactVehicle.longitude.toFixed(6)}${navigationPosition?.accuracyM != null ? ` · precisión ±${Math.round(navigationPosition.accuracyM)} m` : ''}` : 'Esperando ubicación GPS'}
      destination={destination}
      heading={vehicleHeading}
      follow={followVehicle}
      fitKey={`${delivery}:${tracking.etapa_viaje}:${routeFitRequest}`}
      fallback={<RoutePreview route={displayedRoute} vehicle={vehicle} destination={destination} />}
      onManualMove={() => setFollowVehicle(false)}
    />

    <View style={styles.navigationTop} pointerEvents="box-none">
      <View style={styles.turnCard}>
        <Text maxFontSizeMultiplier={1.15} style={styles.turnIcon}>{maneuverSymbol(currentInstruction?.texto)}</Text>
        <View style={styles.turnCopy}>
          <Text maxFontSizeMultiplier={1.15} style={styles.turnDistance}>{currentTurnDistance != null ? formatDistance(currentTurnDistance) : 'Ruta activa'}</Text>
          <Text maxFontSizeMultiplier={1.15} numberOfLines={3} style={styles.turnText}>{currentInstruction?.texto || 'Continúa hacia el destino'}</Text>
        </View>
      </View>
      {nextInstruction ? <View style={styles.nextTurnCard}><Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={styles.nextTurnText}>Después {maneuverSymbol(nextInstruction.texto)} {nextInstruction.texto}</Text></View> : null}
    </View>

    <View style={styles.currentRoadPill}>
      <Text maxFontSizeMultiplier={1.15} style={styles.currentRoadLabel}>CALLE ACTUAL</Text>
      <Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={styles.currentRoadText}>{currentRoad}</Text>
      {navigationPosition ? <Text maxFontSizeMultiplier={1.15} style={styles.gpsQualityText}>
        GPS ±{Math.round(navigationPosition.accuracyM)} m · {Math.round(navigationPosition.speedMps * 3.6)} km/h · {navigationPosition.routeStatus === 'on-route' ? 'en ruta' : 'ajustando'}
      </Text> : null}
    </View>

    <View style={styles.navigationControls}>
      <TouchableOpacity style={styles.roundControl} onPress={() => { setVoiceEnabled((current) => { if (current) Speech.stop(); return !current; }); }}><Text maxFontSizeMultiplier={1.1} style={styles.roundControlText}>{voiceEnabled ? 'Voz' : 'Mudo'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.roundControl} onPress={() => { setFollowVehicle(false); setRouteFitRequest((value) => value + 1); }}><Text maxFontSizeMultiplier={1.1} style={styles.roundControlText}>Ruta</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.roundControl, followVehicle && styles.roundControlActive]} onPress={() => setFollowVehicle(true)}><Text maxFontSizeMultiplier={1.1} style={styles.roundControlText}>Centrar</Text></TouchableOpacity>
      <TouchableOpacity style={styles.roundControl} onPress={() => go('dashboard')}><Text maxFontSizeMultiplier={1.1} style={styles.roundControlText}>Salir</Text></TouchableOpacity>
    </View>

    <View style={styles.navigationBottom}>
      <View style={styles.tripSummary}>
        <Text maxFontSizeMultiplier={1.15} style={styles.tripTime}>{formatDuration(remainingDuration)}</Text>
        <Text maxFontSizeMultiplier={1.15} style={styles.tripMeta}>{formatDistance(remainingDistance)} · llegada {arrivalTime}</Text>
        <Text maxFontSizeMultiplier={1.15} style={styles.tripDestination} numberOfLines={1}>{tracking.destino || 'Destino del viaje'}</Text>
      </View>
      {tracking.etapa_viaje === 'hacia_finca' ? <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canConfirmPickup || confirmingPickup, busy: confirmingPickup }} style={[styles.navigationAction, (!canConfirmPickup || confirmingPickup) && styles.unavailable]} disabled={!canConfirmPickup || confirmingPickup} onPress={confirmPickup}><Text style={styles.navigationActionText}>{confirmingPickup ? 'Confirmando carga…' : canConfirmPickup ? 'Confirmar carga' : 'Acércate a la finca'}</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !allLoadsPicked || completingTrip, busy: completingTrip }} disabled={!allLoadsPicked || completingTrip} style={[styles.navigationAction, (!allLoadsPicked || completingTrip) && styles.unavailable]} onPress={completeTrip}><Text style={styles.navigationActionText}>{completingTrip ? 'Completando viaje…' : 'Completar viaje'}</Text></TouchableOpacity>}
      {navigationError ? <TouchableOpacity accessibilityRole="button" style={styles.navigationRetry} onPress={retryNavigation}><Text style={styles.navigationRetryText}>Reintentar GPS</Text></TouchableOpacity> : null}
      {message && messageType === 'error' ? <Text style={styles.navigationError}>{message}</Text> : null}
    </View>
  </View>;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{role === 'conductor' ? 'Destino, ruta y viaje' : 'Seguimiento de vehículo'}</Text>
      <Text style={styles.muted}>
        El GPS ajusta la frecuencia según movimiento y batería, descarta lecturas inválidas y conserva puntos sin Internet.
      </Text>
      {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}

      {(role === 'coordinador' || role === 'caficultor') && activeDeliveries.length > 1 ? (
        <View style={styles.fullCard}>
          <Text style={styles.label}>{role === 'caficultor' ? 'Carga en seguimiento' : 'Vehículo en seguimiento'}</Text>
          <View style={styles.statusActions}>
            {activeDeliveries.map((item) => (
              <TouchableOpacity
                key={item.id_entrega}
                style={[styles.role, delivery === item.id_entrega && styles.roleActive]}
                onPress={() => {
                  selectDelivery(item.id_entrega);
                  loadTracking(item.id_entrega).catch((error) => setMessage(error.message));
                }}
              >
                <Text>{item.vehiculo_placa || `Entrega ${item.id_entrega.slice(0, 5)}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {role === 'conductor' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado de rastreo</Text>
          <Text>GPS: {gpsState?.servicesEnabled === false ? 'Desactivado' : trackingMode}</Text>
          <Text>Permiso en uso: {gpsState?.foregroundPermission || 'sin consultar'}</Text>
          <Text>Permiso permanente: {gpsState?.backgroundPermission || 'sin consultar'}</Text>
          <Text>Ubicaciones pendientes: {pendingGps}</Text>
          <Text>Canal en tiempo real: {realtimeLabel(realtimeState)}</Text>
          {gpsState?.synchronization?.ultimaSincronizacion ? (
            <Text>Última sincronización: {new Date(gpsState.synchronization.ultimaSincronizacion).toLocaleString()}</Text>
          ) : null}
        </View>
      ) : null}

      {role === 'conductor' && activeTrip ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Cargas de este viaje</Text>
        <Text>{activeTrip.vehiculo_placa} · {activeTrip.cargas.length} carga(s)</Text>
        <View style={styles.statusActions}>{activeTrip.cargas.map((load) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: delivery === load.id_entrega, disabled: Boolean(load.carga_recogida_en) }} key={load.id_entrega} disabled={Boolean(load.carga_recogida_en)} style={[styles.role, delivery === load.id_entrega && styles.roleActive, load.carga_recogida_en && styles.unavailable]} onPress={() => { selectDelivery(load.id_entrega); loadTracking(load.id_entrega).catch((error) => setMessage(error.message)); }}><Text>{load.orden_recoleccion}. {load.caficultor_nombre}{load.carga_recogida_en ? ' ✓' : ''}</Text></TouchableOpacity>)}</View>
      </View> : null}

      {role === 'conductor' && delivery ? <DriverEventReporter deliveryId={delivery} token={token} styles={styles} /> : null}

      {role === 'conductor' && tracking ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Etapa del viaje</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.muted : styles.success}>1. Recoger la carga en la finca</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.success : styles.muted}>2. Llevar la carga a la cooperativa</Text>
        <Text style={styles.label}>Destino actual: {tracking.etapa_viaje === 'hacia_cooperativa' ? tracking.cooperativa_nombre : 'Finca del caficultor'}</Text>
        {tracking.etapa_viaje === 'hacia_finca' && distanceToPickup != null ? <Text>Distancia aproximada al punto de recolección: {distanceToPickup < 1000 ? `${Math.round(distanceToPickup)} m` : `${(distanceToPickup / 1000).toFixed(1)} km`}</Text> : null}
        {tracking.carga_recogida_en ? <Text style={styles.success}>Carga recogida: {new Date(tracking.carga_recogida_en).toLocaleString()}</Text> : null}
      </View> : null}

      {role === 'conductor' && tracking ? <View style={styles.navigationBanner}>
        <Text style={styles.navigationEyebrow}>{navigationStarting ? 'INICIANDO NAVEGACIÓN' : 'NAVEGACIÓN AUTOMÁTICA'}</Text>
        <Text style={styles.navigationInstruction}>{currentInstruction?.texto || 'Continúa hacia el destino indicado'}</Text>
        <Text style={styles.navigationMeta}>
          {route?.distancia_m ? `${formatDistance(route.distancia_m)} · ${formatDuration(route.duracion_s)}` : 'Calculando distancia y tiempo estimado'}
        </Text>
        <Text style={styles.navigationTraffic}>Tráfico en tiempo real no disponible en el modo gratuito.</Text>
        {navigationError ? <TouchableOpacity style={styles.navigationRetry} onPress={retryNavigation}><Text style={styles.navigationRetryText}>Reintentar navegación automática</Text></TouchableOpacity> : null}
      </View> : null}

      {tracking ? (
        <>
          <>
            <View style={[styles.mapPanel, styles.mapPanelCompact]}>
              <MapaAbierto
                style={styles.mapCanvas}
                route={displayedRoute}
                markers={[
                  vehicle ? { id: 'vehicle', kind: 'vehicle', coordinate: vehicle, heading: vehicleHeading, title: tracking.vehiculo_placa, description: `Ubicación GPS ${vehicle.latitude.toFixed(6)}, ${vehicle.longitude.toFixed(6)}` } : null,
                  pickup ? { id: 'pickup', coordinate: pickup, color: tracking.carga_recogida_en ? '#757575' : '#b42318', title: 'Finca del caficultor', description: tracking.recoleccion || 'Punto de recolección' } : null,
                  cooperative ? { id: 'cooperative', coordinate: cooperative, color: '#2e7d32', title: tracking.cooperativa_nombre || 'Cooperativa', description: tracking.cooperativa_destino || 'Destino final' } : null,
                ].filter(Boolean)}
                camera={{ fitMode: 'route', fitKey: `${delivery}:${tracking.etapa_viaje}`, maxZoom: 17, padding: 45 }}
                fallback={<RoutePreview route={displayedRoute} vehicle={vehicle} destination={destination} />}
              />
            </View>
            <Text style={styles.muted}>Ubicación GPS del conductor y recorrido sobre OpenStreetMap. Las coordenadas se actualizan mediante el canal en vivo.</Text>
          </>
          <View style={styles.fullCard}>
            <Text style={styles.cardTitle}>{tracking.vehiculo_placa} · {tracking.estado_entrega}</Text>
            <Text>Estado de ubicación: {locationFreshness}</Text>
            <Text>Distancia recorrida: {((tracking.distancia_recorrida_m || 0) / 1000).toFixed(2)} km</Text>
            {tracking.destino ? <Text>Destino actual: {tracking.destino}</Text> : null}
            {destination ? (
              <Text>Destino actual: {destination.latitude.toFixed(6)}, {destination.longitude.toFixed(6)}</Text>
            ) : <Text style={styles.error}>{tracking.etapa_viaje === 'hacia_cooperativa' ? 'La cooperativa no tiene ubicación.' : 'El caficultor debe guardar la ubicación de su finca.'}</Text>}
            {last ? (
              <Text>
                Última ubicación: {last.latitud.toFixed(6)}, {last.longitud.toFixed(6)} · {new Date(last.registrada_en).toLocaleString()}
                {last.precision_m != null ? ` · precisión ${Math.round(last.precision_m)} m` : ''}
                {last.velocidad_m_s != null ? ` · ${(last.velocidad_m_s * 3.6).toFixed(1)} km/h` : ''}
                {last.rumbo_grados != null ? ` · rumbo ${Math.round(last.rumbo_grados)}°` : ''}
              </Text>
            ) : <Text style={styles.muted}>Todavía no hay posición del vehículo.</Text>}
          </View>
          {role === 'conductor' && route?.instrucciones?.length ? (
            <View style={styles.fullCard}>
              <Text style={styles.cardTitle}>Indicaciones de ruta</Text>
              {route.instrucciones.map((instruction, index) => (
                <Text key={`${typeof instruction === 'string' ? instruction : instruction.texto}-${index}`} style={index === instructionIndex ? styles.success : null}>{index + 1}. {typeof instruction === 'string' ? instruction : instruction.texto}</Text>
              ))}
            </View>
          ) : null}
          {role === 'conductor' && tracking.etapa_viaje === 'hacia_finca' ? (
            <View style={styles.fullCard}>
              <Text style={styles.cardTitle}>Confirmar recogida de la carga</Text>
              <Text style={styles.muted}>El botón se habilita al estar dentro de {tracking.radio_confirmacion_m || 250} m de la finca con una ubicación GPS reciente.</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canConfirmPickup || confirmingPickup, busy: confirmingPickup }} style={[styles.primary, (!canConfirmPickup || confirmingPickup) && styles.unavailable]} disabled={!canConfirmPickup || confirmingPickup} onPress={confirmPickup}>
                <Text style={styles.primaryText}>{confirmingPickup ? 'Confirmando carga…' : canConfirmPickup ? 'Confirmar que ya tengo la carga' : 'Acércate al punto de recolección'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}

      {role === 'conductor' ? (
        <View style={styles.statusActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !allLoadsPicked || completingTrip, busy: completingTrip }} disabled={!allLoadsPicked || completingTrip} style={[styles.primary, (!allLoadsPicked || completingTrip) && styles.unavailable]} onPress={completeTrip}>
            <Text style={styles.primaryText}>{completingTrip ? 'Completando viaje…' : allLoadsPicked ? 'Completar viaje' : 'Recoge todas las cargas para completar'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={load}>
        <Text style={styles.primaryText}>Actualizar ubicación</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
