import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { weight } from '../../servicios/presentacionCarga';
import { styles as defaultStyles } from './EntregasAsignadas.styles';
import { conductorModuleStyles } from '../conductor/Conductor.styles';
import { apiErrorMessage } from '../../servicios/mensajesApi';

export default function EntregasAsignadas({ go, token, user }) {
  const isDriver = user?.rol === 'conductor';
  const styles = isDriver ? { ...defaultStyles, ...conductorModuleStyles, page: { ...conductorModuleStyles.page, padding: 0 } } : defaultStyles;
  const Container = isDriver ? View : ScrollView;
  const containerProps = isDriver ? { style: styles.page } : { contentContainerStyle: styles.page };
  const [trips, setTrips] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);
  const [pendingTrip, setPendingTrip] = useState(null);
  const startingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/viajes/mis-asignados`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudieron consultar tus recolecciones asignadas.'));
      setTrips(data); setError('');
    } catch (reason) { setError(reason.message); }
  }, [token]);
  usePolling(load, 15000);

  const start = async (trip) => {
    if (startingRef.current) return;
    setPendingTrip(null);
    startingRef.current = true;
    setStartingId(trip.id_viaje);
    setError('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/viajes/${trip.id_viaje}/iniciar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo iniciar el viaje.'));
      setMessage('Viaje iniciado. Las cargas ahora aparecen en Seguimiento de vehículo.');
      await load();
      go('tracking');
    } catch (reason) { setError(reason.message); }
    finally { startingRef.current = false; setStartingId(null); }
  };

  return <Container {...containerProps}>
    <Text style={styles.title}>Recolecciones asignadas</Text>
    <Text style={styles.muted}>Los viajes en espera se habilitan automáticamente cuando el vehículo termina su recorrido anterior.</Text>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    {message ? <FeedbackMessage type="success">{message}</FeedbackMessage> : null}
    <View style={styles.grid}>{trips.map((trip) => <View key={trip.id_viaje} style={styles.card}>
      <Text style={styles.cardTitle}>{trip.vehiculo_placa} · {weight(trip.peso_total_kg)}</Text>
      <Text>Destino: {trip.cooperativa_nombre}</Text>
      <Text>Estado: {trip.estado_viaje === 'en_cola' ? `En espera · turno ${trip.orden_cola} · ${trip.orden_cola - 1} viaje(s) antes` : 'Vehículo disponible · listo para iniciar'}</Text>
      <Text style={styles.label}>Cargas del viaje</Text>
      {trip.cargas.map((load) => <Text key={load.id_entrega}>{load.orden_recoleccion}. {load.caficultor_nombre} · {weight(load.cantidad_kg)}</Text>)}
      {trip.puede_iniciar ? <View style={{ backgroundColor: '#064c3b', borderRadius: 8, marginTop: 12, overflow: 'hidden' }}><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: Boolean(startingId), busy: startingId === trip.id_viaje }} disabled={Boolean(startingId)} style={[styles.primary, { backgroundColor: 'transparent' }, startingId && styles.buttonDisabled]} onPress={() => setPendingTrip(trip)}><Text style={styles.primaryText}>{startingId === trip.id_viaje ? 'Iniciando viaje…' : 'Aceptar e iniciar viaje'}</Text></TouchableOpacity></View> : <Text style={styles.muted}>Este vehículo está reservado por un viaje anterior. Se habilitará automáticamente cuando llegue tu turno.</Text>}
    </View>)}</View>
    {!trips.length ? <Text style={styles.muted}>No tienes recolecciones pendientes de iniciar.</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar recolecciones</Text></TouchableOpacity>
    <Modal transparent visible={Boolean(pendingTrip)} animationType="fade" onRequestClose={() => setPendingTrip(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.55)' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#093b30' }}>Tu viaje está a punto de iniciar. ¿Estás seguro?</Text>
          <Text style={{ fontSize: 16, color: '#34443f' }}>Comenzará la ruta del vehículo {pendingTrip?.vehiculo_placa} y se activará el seguimiento GPS.</Text>
          <TouchableOpacity style={{ backgroundColor: '#064c3b', borderRadius: 8, padding: 14, alignItems: 'center' }} onPress={() => start(pendingTrip)}><Text style={{ color: '#fff', fontWeight: '700' }}>Aceptar e iniciar</Text></TouchableOpacity>
          <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={() => setPendingTrip(null)}><Text style={{ color: '#064c3b', fontWeight: '600' }}>Cancelar</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </Container>;
}
