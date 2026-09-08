import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';

import VehicleMarker from '../../componentes/mapas/MarcadorVehiculo';
import RoutePreview from '../../componentes/mapas/VistaPreviaRuta';
import DriverEventReporter from '../../componentes/entregas/ReportadorNovedadConductor';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { NATIVE_MAP_AVAILABLE, RUNNING_IN_EXPO_GO } from '../../configuracion/mapasNativos';
import usePolling from '../../ganchos/usarSondeo';
import {
  detenerRastreoSegundoPlano,
  iniciarRastreoSegundoPlano,
  obtenerEstadoGps,
  procesarLecturaGps,
} from '../../servicios/ubicacionSegundoPlano';
import { canStartTrackingFromGpsResult } from '../../servicios/calidadGps';
import { estaEnLinea, guardarRutaEntrega, obtenerRutaEntrega } from '../../servicios/sinConexion';
import { styles } from './SeguimientoVehiculo.styles';
import { applyTrackingMessage, connectTrackingSocket } from '../../servicios/seguimientoTiempoReal';
import { realtimeLabel, trackingModeLabel } from '../../servicios/presentacionSeguimiento';

const routeService = 'https://router.project-osrm.org/route/v1/driving';
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

const asInstruction = (step) => {
  const maneuver = step.maneuver || {};
  const parts = [maneuver.type, maneuver.modifier, step.name ? `por ${step.name}` : ''];
  return parts.filter(Boolean).join(' ').replace(/^./, (letter) => letter.toUpperCase());
};

export default function SeguimientoVehiculo({ go, token, user }) {
  const [delivery, setDelivery] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [tracking, setTracking] = useState(null);
  const [route, setRoute] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const [gpsState, setGpsState] = useState(null);
  const [realtimeState, setRealtimeState] = useState('disconnected');
  const [confirmingPickup, setConfirmingPickup] = useState(false);
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

  const loadTracking = useCallback(async (id) => {
    const response = await fetchApi(`${API_BASE_URL}/entregas/${id}/seguimiento`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.detail || 'No se pudo obtener la ubicación.');
    setTracking(data);
    return data;
  }, [token]);

  const refreshGpsState = useCallback(async () => {
    if (role === 'conductor') setGpsState(await obtenerEstadoGps());
  }, [role]);

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (role === 'caficultor') {
        const response = await fetchApi(`${API_BASE_URL}/entregas/mi-seguimiento`, { headers });
        const data = await response.json();
        if (!response.ok) throw Error(data.detail || 'No hay vehículo activo para seguir.');
        setDelivery(data.entrega_id);
        setTracking(data);
        setMessage('');
        return;
      }
      if (role === 'conductor') {
        const response = await fetchApi(`${API_BASE_URL}/entregas/mis-asignadas`, { headers });
        const rows = await response.json();
        if (!response.ok) throw Error(rows.detail || 'No se pudieron cargar las entregas.');
        const assigned = rows.find((item) => item.estado_entrega === 'en camino')
          || rows.find((item) => item.estado_entrega === 'pendiente');
        if (!assigned) throw Error('No tienes entregas asignadas activas.');
        setDelivery(assigned.id_entrega);
        await loadTracking(assigned.id_entrega);
        await refreshGpsState();
        setMessage('');
        return;
      }
      const response = await fetchApi(`${API_BASE_URL}/entregas/historial?estado=en%20camino`, { headers });
      const data = await response.json();
      if (!response.ok || !data.items?.length) throw Error('No hay vehículos en camino actualmente.');
      setActiveDeliveries(data.items);
      const selected = data.items.find((item) => item.id_entrega === delivery) || data.items[0];
      setDelivery(selected.id_entrega);
      await loadTracking(selected.id_entrega);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }, [delivery, loadTracking, refreshGpsState, role, token]);

  usePolling(load, 30000);

  useEffect(() => {
    if (!delivery || !token) return undefined;
    return connectTrackingSocket({
      deliveryId: delivery,
      token,
      onMessage: (event) => setTracking((current) => applyTrackingMessage(current, event)),
      onStatus: setRealtimeState,
    });
  }, [delivery, token]);

  const cargarRuta = async (origin, routeDestination = destination, stage = tracking?.etapa_viaje || 'hacia_finca') => {
    if (!delivery || !routeDestination) {
      throw Error(stage === 'hacia_cooperativa'
        ? 'La cooperativa no tiene una ubicación registrada.'
        : 'El caficultor todavía no ha guardado la ubicación de su finca.');
    }
    const routeKey = `${delivery}:${stage}`;
    const saved = await obtenerRutaEntrega(routeKey);
    if (!(await estaEnLinea())) {
      if (saved) {
        setRoute(saved);
        setMessage('Sin internet: mostrando la ruta vial guardada en este celular.', 'warning');
        return;
      }
      setRoute({ puntos: [origin, routeDestination], instrucciones: [], etapa: stage });
      setMessage('Sin internet y sin una ruta guardada: se muestra la dirección directa al destino.', 'warning');
      return;
    }
    try {
      const url = `${routeService}/${origin.longitude},${origin.latitude};${routeDestination.longitude},${routeDestination.latitude}?overview=full&geometries=geojson&steps=true`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const data = await response.json();
      const first = data.routes?.[0];
      if (!response.ok || !first?.geometry?.coordinates?.length) {
        throw Error('No se encontró una ruta vial para estas coordenadas.');
      }
      const next = {
        etapa: stage,
        puntos: first.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
        instrucciones: (first.legs || [])
          .flatMap((leg) => leg.steps || [])
          .map(asInstruction)
          .filter(Boolean)
          .slice(0, 30),
      };
      if (JSON.stringify(next).length <= 1024 * 1024) await guardarRutaEntrega(routeKey, next);
      setRoute(next);
      setMessage('Ruta vial cargada y guardada para usarla también sin internet.', 'success');
    } catch (error) {
      if (saved) {
        setRoute(saved);
        setMessage('No se pudo actualizar la ruta; se muestra la última ruta guardada.');
        return;
      }
      setRoute({ puntos: [origin, routeDestination], instrucciones: [], etapa: stage });
      setMessage(error.name === 'AbortError'
        ? 'El servicio de rutas tardó demasiado; se muestra la dirección directa al destino.'
        : error.message);
    }
  };

  const obtainCurrentPosition = async () => {
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
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(Error('GPS_TIMEOUT')), 15000);
        }),
      ]);
    } catch {
      logGpsStage('lectura_actual_no_disponible');
      const saved = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 150 });
      if (!saved) {
        throw Error('El GPS no entregó una lectura en 15 segundos. Activa la ubicación precisa, sal a un lugar despejado e inténtalo de nuevo.');
      }
      logGpsStage('ultima_lectura_recuperada');
      return saved;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const previewRoute = async () => {
    try {
      const current = await obtainCurrentPosition();
      await cargarRuta(toCoordinate(current.coords.latitude, current.coords.longitude));
    } catch (error) {
      setMessage(error.message);
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
      if (!response.ok) throw Error(result.detail || 'No se pudo confirmar la recogida de la carga.');
      setRoute(null);
      const updated = await loadTracking(delivery);
      const nextDestination = toCoordinate(updated.cooperativa_latitud, updated.cooperativa_longitud);
      await cargarRuta(origin, nextDestination, 'hacia_cooperativa');
      setMessage('Carga confirmada. La ruta ahora te lleva a la cooperativa.', 'success');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setConfirmingPickup(false);
    }
  };

  const confirmBackgroundLocation = async () => {
    if (!(await Location.isBackgroundLocationAvailableAsync())) return true;
    const permission = await Location.getBackgroundPermissionsAsync();
    if (permission.status === 'granted') return true;
    return new Promise((resolve) => {
      Alert.alert(
        'Ubicación durante el viaje',
        'Coffee Fly necesita “Permitir siempre” para registrar la ruta al minimizar la aplicación o apagar la pantalla. Puedes continuar solo en primer plano si no deseas concederlo.',
        [
          { text: 'Solo con la app abierta', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continuar', onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });
  };

  const startGps = async () => {
    logGpsStage('inicio_solicitado', { hasDelivery: Boolean(delivery), hasDestination: Boolean(destination) });
    if (!delivery) return setMessage('Primero carga una entrega asignada.');
    if (!tracking) return setMessage('Espera a que termine de cargar la entrega antes de iniciar el GPS.');
    if (!destination) return setMessage(tracking?.etapa_viaje === 'hacia_cooperativa'
      ? 'La cooperativa debe tener coordenadas para continuar el viaje.'
      : 'La finca debe tener coordenadas antes de iniciar el viaje.');
    try {
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
        if (!response.ok) throw Error(data.detail || 'No se pudo iniciar el viaje.');
        await loadTracking(delivery);
      }
      await cargarRuta(origin);
      const initial = await procesarLecturaGps(delivery, current, token, { force: true });
      logGpsStage('lectura_inicial_procesada', { accepted: initial.accepted, reason: initial.quality?.reason || null });
      // Una lectura válida puede omitirse por ser igual al último punto. Eso evita
      // duplicados, pero no debe impedir reactivar el servicio de seguimiento.
      if (!canStartTrackingFromGpsResult(initial)) {
        throw Error(initial.quality?.reason || 'El GPS no entregó una lectura válida.');
      }
      const requestBackground = await confirmBackgroundLocation();
      logGpsStage('preferencia_segundo_plano', { requested: requestBackground });
      const mode = await iniciarRastreoSegundoPlano(delivery, token, { requestBackground });
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
    } catch (error) {
      setMessage(error.message);
    }
  };

  const stopGps = async () => {
    try {
      await detenerRastreoSegundoPlano();
      await refreshGpsState();
      setMessage('GPS detenido y sesión de rastreo cerrada.', 'success');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const points = tracking?.puntos || [];
  const last = points[points.length - 1];
  const vehicle = last ? toCoordinate(last.latitud, last.longitud) : null;
  const distanceToPickup = distanceMeters(vehicle, pickup);
  const displayedRoute = route?.puntos || points.map((point) => toCoordinate(point.latitud, point.longitud));
  const focus = vehicle || destination || { latitude: 4.711, longitude: -74.0721 };
  const initialRegion = {
    latitude: focus.latitude,
    longitude: focus.longitude,
    latitudeDelta: destination ? 0.08 : 0.03,
    longitudeDelta: destination ? 0.08 : 0.03,
  };
  const pendingGps = gpsState?.synchronization?.gpsPendientes || 0;
  const trackingMode = trackingModeLabel({
    taskStarted: gpsState?.taskStarted,
    deliveryId: gpsState?.tracking?.deliveryId,
    runningInExpoGo: RUNNING_IN_EXPO_GO,
  });
  const lastAgeSeconds = last ? Math.max(0, (Date.now() - Date.parse(last.registrada_en)) / 1000) : null;
  const canConfirmPickup = tracking?.estado_entrega === 'en camino'
    && !tracking?.carga_recogida_en
    && distanceToPickup != null
    && distanceToPickup <= Number(tracking?.radio_confirmacion_m || 250)
    && lastAgeSeconds <= 300;
  const locationFreshness = lastAgeSeconds == null
    ? 'Sin ubicación'
    : lastAgeSeconds <= 90 ? 'Actualizada' : `Desactualizada (${Math.round(lastAgeSeconds / 60)} min)`;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{role === 'conductor' ? 'Destino, ruta y viaje' : 'Seguimiento de vehículo'}</Text>
      <Text style={styles.muted}>
        El GPS ajusta la frecuencia según movimiento y batería, descarta lecturas inválidas y conserva puntos sin Internet.
      </Text>
      {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}

      {role === 'coordinador' && activeDeliveries.length > 1 ? (
        <View style={styles.fullCard}>
          <Text style={styles.label}>Vehículo en seguimiento</Text>
          <View style={styles.statusActions}>
            {activeDeliveries.map((item) => (
              <TouchableOpacity
                key={item.id_entrega}
                style={[styles.role, delivery === item.id_entrega && styles.roleActive]}
                onPress={() => {
                  setDelivery(item.id_entrega);
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

      {role === 'conductor' && delivery ? <DriverEventReporter deliveryId={delivery} token={token} styles={styles} /> : null}

      {role === 'conductor' && tracking ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Etapa del viaje</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.muted : styles.success}>1. Recoger la carga en la finca</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.success : styles.muted}>2. Llevar la carga a la cooperativa</Text>
        <Text style={styles.label}>Destino actual: {tracking.etapa_viaje === 'hacia_cooperativa' ? tracking.cooperativa_nombre : 'Finca del caficultor'}</Text>
        {tracking.etapa_viaje === 'hacia_finca' && distanceToPickup != null ? <Text>Distancia aproximada al punto de recolección: {distanceToPickup < 1000 ? `${Math.round(distanceToPickup)} m` : `${(distanceToPickup / 1000).toFixed(1)} km`}</Text> : null}
        {tracking.carga_recogida_en ? <Text style={styles.success}>Carga recogida: {new Date(tracking.carga_recogida_en).toLocaleString()}</Text> : null}
      </View> : null}

      {tracking ? (
        <>
          {NATIVE_MAP_AVAILABLE ? (
            <>
              <View style={[styles.mapPanel, styles.mapPanelCompact]}>
                <MapView
                  key={`${delivery}-${tracking.etapa_viaje}`}
                  style={styles.mapCanvas}
                  mapType="standard"
                  initialRegion={initialRegion}
                  loadingEnabled
                  showsCompass
                  showsScale
                  showsUserLocation={role === 'conductor'}
                  showsMyLocationButton={role === 'conductor'}
                  toolbarEnabled
                  zoomControlEnabled
                >
                  {vehicle ? <VehicleMarker coordinate={vehicle} title={tracking.vehiculo_placa} description="Ubicación del vehículo" /> : null}
                  {pickup ? <Marker coordinate={pickup} title="Finca del caficultor" description={tracking.recoleccion || 'Punto de recolección'} pinColor={tracking.carga_recogida_en ? '#757575' : '#b42318'} /> : null}
                  {cooperative ? <Marker coordinate={cooperative} title={tracking.cooperativa_nombre || 'Cooperativa'} description={tracking.cooperativa_destino || 'Destino final'} pinColor="#2e7d32" /> : null}
                  {displayedRoute.length > 1 ? <Polyline coordinates={displayedRoute} strokeColor="#386641" strokeWidth={4} /> : null}
                </MapView>
              </View>
              <Text style={styles.muted}>
                Puedes acercar, mover y orientar el mapa. Sin red se conserva la línea del recorrido; el mapa base puede requerir conexión.
              </Text>
            </>
          ) : (
            <View style={styles.fullCard}>
              <Text style={styles.cardTitle}>Seguimiento GPS activo sin mapa integrado</Text>
              <Text>
                Este APK no tiene configurada una clave de Google Maps para Android. La ubicación, la ruta,
                el trabajo en segundo plano y la sincronización continúan funcionando con normalidad.
              </Text>
              <Text style={styles.muted}>
                Para mostrar el mapa se necesita generar un nuevo APK con GOOGLE_MAPS_ANDROID_API_KEY.
              </Text>
              <RoutePreview route={displayedRoute} vehicle={vehicle} destination={destination} />
            </View>
          )}
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
                <Text key={`${instruction}-${index}`}>{index + 1}. {instruction}</Text>
              ))}
            </View>
          ) : null}
          {role === 'conductor' && tracking.etapa_viaje === 'hacia_finca' ? (
            <View style={styles.fullCard}>
              <Text style={styles.cardTitle}>Confirmar recogida de la carga</Text>
              <Text style={styles.muted}>El botón se habilita al estar dentro de {tracking.radio_confirmacion_m || 250} m de la finca con una ubicación GPS reciente.</Text>
              <TouchableOpacity style={[styles.primary, (!canConfirmPickup || confirmingPickup) && styles.unavailable]} disabled={!canConfirmPickup || confirmingPickup} onPress={confirmPickup}>
                <Text style={styles.primaryText}>{confirmingPickup ? 'Confirmando carga…' : canConfirmPickup ? 'Confirmar que ya tengo la carga' : 'Acércate al punto de recolección'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}

      {role === 'conductor' ? (
        <View style={styles.statusActions}>
          <TouchableOpacity style={styles.statusButton} onPress={previewRoute}>
            <Text style={styles.statusButtonText}>Ver y guardar ruta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primary, (!tracking || !destination) && styles.unavailable]}
            onPress={startGps}
            disabled={!tracking || !destination}
          >
            <Text style={styles.primaryText}>
              {!tracking
                ? 'Cargando entrega…'
                : !destination
                  ? 'Destino sin ubicación'
                  : tracking.estado_entrega === 'pendiente' ? 'Iniciar viaje y GPS' : 'Iniciar GPS'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statusButton} onPress={stopGps}>
            <Text style={styles.statusButtonText}>Detener GPS</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <TouchableOpacity style={styles.primary} onPress={load}>
        <Text style={styles.primaryText}>Actualizar ubicación</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
