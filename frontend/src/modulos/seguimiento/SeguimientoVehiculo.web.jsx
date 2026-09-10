import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import TrackingMap from '../../componentes/mapas/MapaSeguimiento';
import DriverEventReporter from '../../componentes/entregas/ReportadorNovedadConductor';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { applyTrackingMessage, connectTrackingSocket } from '../../servicios/seguimientoTiempoReal';
import { realtimeLabel } from '../../servicios/presentacionSeguimiento';
import { styles } from './SeguimientoVehiculo.styles';

const freshnessOf = (point) => {
  if (!point?.registrada_en) return 'Sin ubicación';
  return Date.now() - Date.parse(point.registrada_en) <= 90000 ? 'Actualizada' : 'Desactualizada';
};

export default function SeguimientoVehiculo({ go, token, user }) {
  const [delivery, setDelivery] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [message, setMessage] = useState('');
  const [realtimeState, setRealtimeState] = useState('disconnected');
  const role = String(user?.rol || '').toLowerCase();

  const loadTracking = useCallback(async (id) => {
    const response = await fetchApi(`${API_BASE_URL}/entregas/${id}/seguimiento`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.detail || 'No se pudo consultar el seguimiento.');
    setTracking(data);
  }, [token]);

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (role === 'caficultor') {
        const response = await fetchApi(`${API_BASE_URL}/entregas/mi-seguimiento`, { headers });
        const data = await response.json();
        if (!response.ok) throw Error(data.detail || 'No hay vehículo activo para seguir.');
        setDelivery(data.entrega_id);
        setTracking(data);
      } else if (role === 'conductor') {
        const response = await fetchApi(`${API_BASE_URL}/viajes/mi-activo`, { headers });
        const rows = await response.json();
        if (!response.ok) throw Error(rows.detail || 'No se pudo cargar tu viaje.');
        const trip = rows[0];
        if (!trip) throw Error('No tienes un viaje en camino. Inícialo desde Recolecciones asignadas.');
        setActiveTrip(trip);
        const active = trip.cargas.find((item) => item.id_entrega === delivery) || trip.cargas[0];
        setDelivery(active.id_entrega);
        await loadTracking(active.id_entrega);
      } else {
        const response = await fetchApi(`${API_BASE_URL}/entregas/historial?estado=en%20camino`, { headers });
        const list = await response.json();
        if (!response.ok || !list.items?.length) throw Error('No hay vehículos en camino actualmente.');
        setActiveDeliveries(list.items);
        const selected = list.items.find((item) => item.id_entrega === delivery) || list.items[0];
        setDelivery(selected.id_entrega);
        await loadTracking(selected.id_entrega);
      }
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }, [delivery, loadTracking, role, token]);

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

  const points = tracking?.puntos || [];
  const last = points.at(-1);
  const destination = useMemo(() => {
    if (tracking?.destino_latitud == null || tracking?.destino_longitud == null) return null;
    return {
      latitude: Number(tracking.destino_latitud),
      longitude: Number(tracking.destino_longitud),
    };
  }, [tracking?.destino_latitud, tracking?.destino_longitud]);
  const openMap = () => last && Linking.openURL(`https://www.google.com/maps?q=${last.latitud},${last.longitud}`);
  const completeTrip = async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/viajes/${activeTrip.id_viaje}/completar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo completar el viaje.');
      setActiveTrip(null); setTracking(null); setDelivery(null);
      setMessage('Viaje completado.');
    } catch (error) { setMessage(error.message); }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Seguimiento de vehículo</Text>
      <Text style={styles.muted}>
        Estado: {realtimeLabel(realtimeState)}. El sistema recupera el estado cada 30 segundos si se interrumpe el canal en vivo.
      </Text>
      {message ? <FeedbackMessage type="error">{message}</FeedbackMessage> : null}

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

      {role === 'conductor' && activeTrip ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Cargas de este viaje</Text>
        <View style={styles.statusActions}>{activeTrip.cargas.map((load) => <TouchableOpacity key={load.id_entrega} style={[styles.role, delivery === load.id_entrega && styles.roleActive]} onPress={() => { setDelivery(load.id_entrega); loadTracking(load.id_entrega).catch((error) => setMessage(error.message)); }}><Text>{load.orden_recoleccion}. {load.caficultor_nombre}{load.carga_recogida_en ? ' ✓' : ''}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.primary} onPress={completeTrip}><Text style={styles.primaryText}>Viaje completado</Text></TouchableOpacity>
      </View> : null}

      {role === 'conductor' && delivery ? <DriverEventReporter deliveryId={delivery} token={token} styles={styles} /> : null}

      {role === 'conductor' && tracking ? <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>Etapa del viaje</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.muted : styles.success}>1. Recoger la carga en la finca</Text>
        <Text style={tracking.etapa_viaje === 'hacia_cooperativa' ? styles.success : styles.muted}>2. Llevar la carga a la cooperativa</Text>
        <Text>Destino actual: {tracking.destino || 'Sin ubicación registrada'}</Text>
        {tracking.carga_recogida_en ? <Text style={styles.success}>Carga recogida: {new Date(tracking.carga_recogida_en).toLocaleString()}</Text> : <Text style={styles.muted}>La carga se confirma desde GPS y trayecto en la aplicación móvil.</Text>}
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

          <TrackingMap destination={destination} points={points} />

          {last ? (
            <TouchableOpacity style={styles.primary} onPress={openMap}>
              <Text style={styles.primaryText}>Abrir ubicación en Google Maps</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity style={styles.primary} onPress={load}>
        <Text style={styles.primaryText}>Actualizar ubicación</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
