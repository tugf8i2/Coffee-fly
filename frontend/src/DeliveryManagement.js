import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from './config';
import usePolling from './hooks/usePolling';
import { fetchDeliveryHistories } from './services/deliveryHistory';

const formatDate = (value) => new Date(value).toLocaleString();

export default function DeliveryManagement({ go, token, styles }) {
  const [requests, setRequests] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [observations, setObservations] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState({});

  const load = useCallback(async () => {
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestsResponse, deliveriesResponse] = await Promise.all([
        fetchApi(`${API_BASE_URL}/entregas/solicitudes-activas`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/`, { headers }),
      ]);
      const [requestsData, deliveriesData] = await Promise.all([requestsResponse.json(), deliveriesResponse.json()]);
      if (!requestsResponse.ok) throw Error(requestsData.detail || 'No se pudieron consultar las solicitudes activas.');
      if (!deliveriesResponse.ok) throw Error(deliveriesData.detail || 'No se pudieron consultar las entregas.');
      setRequests(requestsData);
      setDeliveries(deliveriesData);
      setHistory(await fetchDeliveryHistories(deliveriesData, token));
    } catch (reason) {
      setError(reason.message);
    }
  }, [token]);

  usePolling(load, 15000);

  const register = async () => {
    if (!selected) return setError('Selecciona una solicitud activa.');
    setError('');
    setMessage('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          solicitud_id: selected.id_solicitud,
          fecha_hora_entrega: new Date().toISOString(),
          observaciones: observations.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.detail || 'No se pudo registrar la entrega.');
      setMessage('Entrega registrada con estado Pendiente.');
      setSelected(null);
      setObservations('');
      await load();
    } catch (reason) {
      setError(reason.message);
    }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Registro de entrega de café</Text>
    <Text style={styles.muted}>Selecciona una solicitud activa del caficultor. La asignación de vehículo se realiza posteriormente.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}

    <Text style={styles.section}>Solicitudes activas</Text>
    {requests.map((request) => <TouchableOpacity key={request.id_solicitud} style={[styles.card, selected?.id_solicitud === request.id_solicitud && styles.cardSelected]} onPress={() => setSelected(request)}>
      <Text style={styles.cardTitle}>{request.caficultor_nombre}</Text>
      <Text>Solicitud: {request.id_solicitud.slice(0, 8)}</Text>
      <Text>Cantidad solicitada: {request.cantidad_solicitada_kg} kg</Text>
      <Text>Fecha de solicitud: {formatDate(request.fecha_hora_solicitud)}</Text>
    </TouchableOpacity>)}
    {!requests.length ? <Text style={styles.muted}>No hay solicitudes activas disponibles para registrar.</Text> : null}

    {selected ? <View style={styles.card}>
      <Text style={styles.cardTitle}>Nueva entrega para {selected.caficultor_nombre}</Text>
      <Text style={styles.label}>Cantidad de la solicitud (kg)</Text>
      <Text style={styles.readonly}>{selected.cantidad_solicitada_kg} kg</Text>
      <Text style={styles.muted}>Este valor se toma automáticamente de la solicitud y no se puede modificar aquí.</Text>
      <Text style={styles.label}>Fecha y hora</Text>
      <Text style={styles.readonly}>{formatDate(new Date())}</Text>
      <Text style={styles.label}>Observaciones (opcional)</Text>
      <TextInput style={[styles.input, styles.textArea]} value={observations} onChangeText={setObservations} multiline placeholder="Observaciones de la entrega" />
      <TouchableOpacity style={styles.primary} onPress={register}><Text style={styles.primaryText}>Registrar entrega</Text></TouchableOpacity>
    </View> : null}

    <Text style={styles.section}>Entregas del día</Text>
    {deliveries.map((delivery) => <View style={styles.card} key={delivery.id_entrega}>
      <Text style={styles.cardTitle}>{delivery.cantidad_kg} kg · {delivery.estado_entrega}</Text>
      <Text>Caficultor: #{delivery.caficultor_id}</Text>
      <Text>Fecha: {formatDate(delivery.fecha_hora_entrega)}</Text>
      {delivery.observaciones ? <Text>Observaciones: {delivery.observaciones}</Text> : null}
      {history[delivery.id_entrega]?.length ? <View style={styles.history}><Text style={styles.label}>Último cambio</Text><Text>{history[delivery.id_entrega][0].estado_anterior} → {history[delivery.id_entrega][0].estado_nuevo} · {history[delivery.id_entrega][0].usuario_nombre} · {formatDate(history[delivery.id_entrega][0].fecha_hora_cambio)}</Text></View> : <Text style={styles.muted}>Aún no hay cambios de estado.</Text>}
    </View>)}
    {!deliveries.length ? <Text style={styles.muted}>Aún no hay entregas registradas.</Text> : null}
    <Text style={styles.muted}>El listado se actualiza automáticamente cada 15 segundos.</Text><TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar listado</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
