import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { weight } from '../../servicios/presentacionCarga';
import { styles } from './EntregasAsignadas.styles';

export default function EntregasAsignadas({ go, token }) {
  const [trips, setTrips] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/viajes/mis-asignados`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudieron consultar tus recolecciones asignadas.');
      setTrips(data); setError('');
    } catch (reason) { setError(reason.message); }
  }, [token]);
  usePolling(load, 15000);

  const start = async (trip) => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/viajes/${trip.id_viaje}/iniciar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo iniciar el viaje.');
      setMessage('Viaje iniciado. Las cargas ahora aparecen en Seguimiento de vehículo.');
      await load();
      go('tracking');
    } catch (reason) { setError(reason.message); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Recolecciones asignadas</Text>
    <Text style={styles.muted}>Los viajes en espera se habilitan automáticamente cuando el vehículo termina su recorrido anterior.</Text>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    {message ? <FeedbackMessage type="success">{message}</FeedbackMessage> : null}
    <View style={styles.grid}>{trips.map((trip) => <View key={trip.id_viaje} style={styles.card}>
      <Text style={styles.cardTitle}>{trip.vehiculo_placa} · {weight(trip.peso_total_kg)}</Text>
      <Text>Destino: {trip.cooperativa_nombre}</Text>
      <Text>Estado: {trip.estado_viaje === 'en_cola' ? `En espera · turno ${trip.orden_cola}` : 'Listo para iniciar'}</Text>
      <Text style={styles.label}>Cargas del viaje</Text>
      {trip.cargas.map((load) => <Text key={load.id_entrega}>{load.orden_recoleccion}. {load.caficultor_nombre} · {weight(load.cantidad_kg)}</Text>)}
      {trip.puede_iniciar ? <TouchableOpacity style={styles.primary} onPress={() => start(trip)}><Text style={styles.primaryText}>En camino</Text></TouchableOpacity> : <Text style={styles.muted}>Esperando disponibilidad del vehículo.</Text>}
    </View>)}</View>
    {!trips.length ? <Text style={styles.muted}>No tienes recolecciones pendientes de iniciar.</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar recolecciones</Text></TouchableOpacity>
  </ScrollView>;
}
