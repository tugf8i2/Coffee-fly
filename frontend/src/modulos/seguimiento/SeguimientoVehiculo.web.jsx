import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import TrackingMap from '../../componentes/mapas/MapaSeguimiento';
import DriverEventReporter from '../../componentes/entregas/ReportadorNovedadConductor';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { applyTrackingMessage, connectTrackingSocket } from '../../servicios/seguimientoTiempoReal';
import { canCompleteTrip, realtimeLabel } from '../../servicios/presentacionSeguimiento';
import { styles } from './SeguimientoVehiculo.styles';
import { apiErrorMessage } from '../../servicios/mensajesApi';
import { createGpsPoint, MAX_GPS_ACCURACY_METERS } from '../../servicios/calidadGps';
import { OSRM_BASE_URL } from '../../configuracion/osrm';
import { createLatestRequestController } from '../../servicios/controlSolicitudes';

const freshnessOf = (point) => {
  if (!point?.registrada_en) return 'Sin ubicación';
  return Date.now() - Date.parse(point.registrada_en) <= 90000 ? 'Actualizada' : 'Desactualizada';
};

export default function SeguimientoVehiculo({ go, token, user }) {
  const [delivery, setDelivery] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState([]);
  const actionRef = useRef(null);
  const deliveryRef = useRef(null);
  const trackingRequestsRef = useRef(null);
  if (!trackingRequestsRef.current) trackingRequestsRef.current = createLatestRequestController();
  const [realtimeState, setRealtimeState] = useState('disconnected');
  const role = String(user?.rol || '').toLowerCase();

  const selectDelivery = useCallback((id) => {
    deliveryRef.current = id;
    setDelivery(id);
  }, []);

  const loadTracking = useCallback(async (id) => {
    const request = trackingRequestsRef.current.start();
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/${id}/seguimiento`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: request.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo consultar el seguimiento.'));
      if (trackingRequestsRef.current.isCurrent(request) && deliveryRef.current === id) setTracking(data);
      return trackingRequestsRef.current.isCurrent(request) ? data : null;
    } catch (error) {
      if (!trackingRequestsRef.current.isCurrent(request)) return null;
      throw error;
    }
  }, [token]);

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
      } else if (role === 'conductor') {
        const response = await fetchApi(`${API_BASE_URL}/viajes/mi-activo`, { headers });
        const rows = await response.json();
        if (!response.ok) {
          if (response.status === 404) { setActiveTrip(null); selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null); }
          throw Error(apiErrorMessage(rows, 'No se pudo cargar tu viaje.'));
        }
        const trip = rows[0];
        if (!trip) {
          setActiveTrip(null); selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null);
          setMessage('No tienes un viaje en camino. Inícialo desde Recolecciones asignadas.', 'info');
          return;
        }
        setActiveTrip(trip);
        const active = trip.cargas.find((item) => item.id_entrega === deliveryRef.current && !item.carga_recogida_en)
          || trip.cargas.find((item) => !item.carga_recogida_en)
          || trip.cargas.at(-1);
        selectDelivery(active.id_entrega);
        await loadTracking(active.id_entrega);
      } else {
        const response = await fetchApi(`${API_BASE_URL}/entregas/historial?estado=en%20camino`, { headers });
        const list = await response.json();
        if (!response.ok) throw Error(apiErrorMessage(list, 'No se pudo consultar los vehículos en camino.'));
        if (!list.items?.length) {
          setActiveDeliveries([]); selectDelivery(null); trackingRequestsRef.current.invalidate(); setTracking(null);
          setMessage('No hay vehículos en camino actualmente.', 'info');
          return;
        }
        setActiveDeliveries(list.items);
        const selected = list.items.find((item) => item.id_entrega === deliveryRef.current) || list.items[0];
        selectDelivery(selected.id_entrega);
        await loadTracking(selected.id_entrega);
      }
      setMessage('', 'info');
    } catch (error) {
      setMessage(error.message);
    }
  }, [loadTracking, role, selectDelivery, token]);

  usePolling(load, 30000);

  useEffect(() => () => trackingRequestsRef.current.invalidate(), []);

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

  const points = tracking?.puntos || [];
  const last = points.at(-1);
  const destination = useMemo(() => {
    if (tracking?.destino_latitud == null || tracking?.destino_longitud == null) return null;
    return {
      latitude: Number(tracking.destino_latitud),
      longitude: Number(tracking.destino_longitud),
    };
  }, [tracking?.destino_latitud, tracking?.destino_longitud]);
  const routeOriginKey = last ? `${Number(last.latitud).toFixed(3)}:${Number(last.longitud).toFixed(3)}` : '';

  useEffect(() => {
    if (!last || !destination) { setNavigationRoute([]); return undefined; }
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 12000);
    const coordinates = `${Number(last.longitud)},${Number(last.latitud)};${destination.longitude},${destination.latitude}`;
    fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(Error('Ruta no disponible')))
      .then((data) => {
        clearTimeout(timeout);
        const routeCoordinates = data.routes?.[0]?.geometry?.coordinates;
        if (!disposed && Array.isArray(routeCoordinates)) setNavigationRoute(routeCoordinates.map(([longitude, latitude]) => ({ latitude, longitude })));
      })
      .catch(() => { if (!disposed) setNavigationRoute([]); });
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [delivery, destination?.latitude, destination?.longitude, routeOriginKey]);
  const allLoadsPicked = canCompleteTrip(activeTrip?.cargas);

  const currentWebPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Error('Este navegador no permite consultar la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      if (error.code === 1) reject(Error('Permite la ubicación precisa del navegador para confirmar la carga.'));
      else if (error.code === 3) reject(Error('El GPS tardó demasiado. Sal a un lugar despejado e inténtalo nuevamente.'));
      else reject(Error('No fue posible obtener tu ubicación actual.'));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });

  const registerCurrentGps = async () => {
    const position = await currentWebPosition();
    if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > MAX_GPS_ACCURACY_METERS) {
      throw Error(`La precisión actual es insuficiente (${Math.round(position.coords.accuracy || 0)} m). Espera una señal menor a ${MAX_GPS_ACCURACY_METERS} m.`);
    }
    const locationResponse = await fetchApi(`${API_BASE_URL}/entregas/${delivery}/ubicacion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(createGpsPoint(position)),
    });
    const locationData = await locationResponse.json();
    if (!locationResponse.ok) throw Error(apiErrorMessage(locationData, 'No se pudo registrar tu ubicación.'));
  };

  const confirmPickup = async () => {
    if (!delivery || actionRef.current) return;
    actionRef.current = 'pickup';
    setConfirmingPickup(true);
    try {
      setMessage('Obteniendo una ubicación precisa para confirmar la carga…', 'info');
      await registerCurrentGps();
      const response = await fetchApi(`${API_BASE_URL}/entregas/${delivery}/confirmar-carga`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo confirmar la recogida de la carga.'));
      await load();
      setMessage('Carga recogida confirmada correctamente.', 'success');
    } catch (error) { setMessage(error.message, 'error'); }
    finally { actionRef.current = null; setConfirmingPickup(false); }
  };

  const completeTrip = async () => {
    if (!activeTrip || !allLoadsPicked || actionRef.current) return;
    if (!(globalThis.confirm?.('¿Confirmas que entregaste todas las cargas y deseas completar el viaje?') ?? false)) return;
    actionRef.current = 'complete';
    setCompletingTrip(true);
    try {
      setMessage('Verificando tu llegada a la cooperativa con GPS…', 'info');
      await registerCurrentGps();
      const response = await fetchApi(`${API_BASE_URL}/viajes/${activeTrip.id_viaje}/completar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo completar el viaje.'));
       setActiveTrip(null); setTracking(null); selectDelivery(null); trackingRequestsRef.current.invalidate();
      setMessage('Viaje completado. El vehículo quedó disponible.', 'success');
    } catch (error) { setMessage(error.message, 'error'); }
    finally { actionRef.current = null; setCompletingTrip(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Seguimiento de vehículo</Text>
      <Text style={styles.muted}>
        Estado: {realtimeLabel(realtimeState)}. El sistema recupera el estado cada 30 segundos si se interrumpe el canal en vivo.
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

      {role === 'conductor' && activeTrip ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Cargas de este viaje</Text>
        <View style={styles.statusActions}>{activeTrip.cargas.map((load) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: delivery === load.id_entrega }} key={load.id_entrega} style={[styles.role, delivery === load.id_entrega && styles.roleActive]} onPress={() => { selectDelivery(load.id_entrega); loadTracking(load.id_entrega).catch((error) => setMessage(error.message)); }}><Text>{load.orden_recoleccion}. {load.caficultor_nombre}{load.carga_recogida_en ? ' ✓' : ''}</Text></TouchableOpacity>)}</View>
        {!allLoadsPicked ? <Text style={styles.muted}>Confirma la recogida de todas las cargas antes de completar el viaje.</Text> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !allLoadsPicked || completingTrip, busy: completingTrip }} disabled={!allLoadsPicked || completingTrip} style={[styles.primary, (!allLoadsPicked || completingTrip) && styles.unavailable]} onPress={completeTrip}><Text style={styles.primaryText}>{completingTrip ? 'Completando viaje…' : 'Completar viaje'}</Text></TouchableOpacity>
      </View> : null}

      {role === 'conductor' && delivery ? <DriverEventReporter deliveryId={delivery} token={token} styles={styles} /> : null}

      {role === 'conductor' && tracking ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Etapa del viaje</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.muted : styles.success}>1. Recoger la carga en la finca</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.success : styles.muted}>2. Llevar la carga a la cooperativa</Text>
        <Text>Destino actual: {tracking.destino || 'Sin ubicación registrada'}</Text>
        {tracking.carga_recogida_en ? <Text style={styles.success}>Carga recogida: {new Date(tracking.carga_recogida_en).toLocaleString()}</Text> : <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: confirmingPickup, busy: confirmingPickup }} disabled={confirmingPickup} style={[styles.primary, confirmingPickup && styles.unavailable]} onPress={confirmPickup}><Text style={styles.primaryText}>{confirmingPickup ? 'Verificando ubicación…' : 'Confirmar carga con GPS'}</Text></TouchableOpacity>}
      </View> : null}

      {tracking ? (
        <View style={styles.fullCard}>
          <Text style={styles.cardTitle}>{tracking.vehiculo_placa} · {tracking.estado_entrega}</Text>
          {tracking.destino ? <Text>Destino: {tracking.destino}</Text> : null}
          <Text>Ruta visible: {points.length} de {tracking.total_puntos || points.length} punto(s)</Text>
          <Text>Estado de ubicación: {freshnessOf(last)}</Text>
          <Text>Distancia recorrida: {((tracking.distancia_recorrida_m || 0) / 1000).toFixed(2)} km</Text>
          {tracking.ruta_truncada ? <Text style={styles.muted}>Se muestran los 2.000 puntos más recientes para conservar el rendimiento.</Text> : null}
          {last ? (
            <Text>
              Última ubicación: {Number(last.latitud).toFixed(6)}, {Number(last.longitud).toFixed(6)} · {new Date(last.registrada_en).toLocaleString()}
              {last.precision_m != null ? ` · precisión ${Math.round(last.precision_m)} m` : ''}
              {last.velocidad_m_s != null ? ` · ${(last.velocidad_m_s * 3.6).toFixed(1)} km/h` : ''}
              {last.rumbo_grados != null ? ` · rumbo ${Math.round(last.rumbo_grados)}°` : ''}
            </Text>
          ) : <Text style={styles.muted}>Esperando ubicación GPS del conductor.</Text>}

          <TrackingMap deliveryId={delivery} destination={destination} navigationRoute={navigationRoute} points={points} />

        </View>
      ) : null}

      <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={load}>
        <Text style={styles.primaryText}>Actualizar ubicación</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
