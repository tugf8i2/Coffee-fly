import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import TrackingMap from '../components/TrackingMap';
import DriverEventReporter from '../components/DriverEventReporter';
import { API_BASE_URL, fetchApi } from '../config';
import usePolling from '../hooks/usePolling';
import { applyTrackingMessage, connectTrackingSocket } from '../services/trackingRealtime';
import { realtimeLabel } from '../services/trackingPresentation';

const freshnessOf = (point) => {
  if (!point?.registrada_en) return 'Sin ubicación';
  return Date.now() - Date.parse(point.registrada_en) <= 90000 ? 'Actualizada' : 'Desactualizada';
};

export default function SeguimientoVehiculo({ go, token, styles, user }) {
  const [delivery, setDelivery] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
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
        const response = await fetchApi(`${API_BASE_URL}/entregas/mis-asignadas`, { headers });
        const rows = await response.json();
        if (!response.ok) throw Error(rows.detail || 'No se pudieron cargar tus entregas.');
        const active = rows.find((row) => row.estado_entrega === 'en camino');
        if (!active) throw Error('No tienes una entrega en camino. Iníciala desde la aplicación móvil.');
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

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Seguimiento de vehículo</Text>
      <Text style={styles.muted}>
        Estado: {realtimeLabel(realtimeState)}. El sistema recupera el estado cada 30 segundos si se interrumpe el canal en vivo.
      </Text>
      {message ? <Text style={styles.error}>{message}</Text> : null}

      {role === 'coordinador' && activeDeliveries.length > 1 ? (
        <View style={styles.card}>
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

      {role === 'conductor' && delivery ? <DriverEventReporter deliveryId={delivery} token={token} styles={styles} /> : null}

      {tracking ? (
        <View style={styles.card}>
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
      <TouchableOpacity onPress={() => go('dashboard')}>
        <Text style={styles.link}>Volver al dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
