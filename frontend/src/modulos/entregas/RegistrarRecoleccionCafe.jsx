import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { fetchDeliveryHistories } from '../../servicios/historialEntregas';
import { bagSummary, tonnes, weight } from '../../servicios/presentacionCarga';

const formatDate = (value) => new Date(value).toLocaleString();

export default function RegistrarRecoleccionCafe({ go, token, styles }) {
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
    if (!selected) return setError('Selecciona una solicitud activa para registrar la recolección.');
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
      if (!response.ok) throw Error(result.detail || 'No se pudo registrar la recolección.');
      setMessage('Recolección de café registrada con estado Pendiente.');
      setSelected(null);
      setObservations('');
      await load();
    } catch (reason) {
      setError(reason.message);
    }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.deliveryHeader}>
      <Text style={styles.title}>Registrar recolección de café</Text>
      <Text style={styles.muted}>Selecciona una solicitud activa del caficultor y confirma la recolección. La asignación de vehículo se realiza posteriormente.</Text>
    </View>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    {message ? <FeedbackMessage type="success">{message}</FeedbackMessage> : null}

    <Text style={styles.section}>Solicitudes activas</Text>
    <View style={styles.grid}>{requests.map((request) => <TouchableOpacity key={request.id_solicitud} style={[styles.card, selected?.id_solicitud === request.id_solicitud && styles.cardSelected]} onPress={() => setSelected(request)}>
      <Text style={styles.cardTitle}>{request.caficultor_nombre}</Text>
      <Text>Solicitud: {request.id_solicitud.slice(0, 8)}</Text>
      <Text style={styles.totalValue}>{tonnes(request.cantidad_solicitada_kg)}</Text>
      {bagSummary(request) ? <Text>{bagSummary(request)}</Text> : null}
      <Text>Fecha de solicitud: {formatDate(request.fecha_hora_solicitud)}</Text>
    </TouchableOpacity>)}</View>
    {!requests.length ? <Text style={styles.muted}>No hay solicitudes activas disponibles para registrar.</Text> : null}

    <View style={styles.deliveryForm}>
      <Text style={styles.cardTitle}>{selected ? `Nueva recolección para ${selected.caficultor_nombre}` : 'Nueva recolección'}</Text>
      {selected ? <>
        <Text style={styles.label}>Peso total de la solicitud</Text>
        <Text style={styles.readonly}>{weight(selected.cantidad_solicitada_kg)}</Text>
        {bagSummary(selected) ? <Text>{bagSummary(selected)}</Text> : null}
        <Text style={styles.muted}>Este valor se toma automáticamente de la solicitud y no se puede modificar aquí.</Text>
      </> : <Text style={styles.selectionHint}>Selecciona una de las solicitudes activas para habilitar el registro.</Text>}
      <Text style={styles.label}>Fecha y hora</Text>
      <Text style={styles.readonly}>{formatDate(new Date())}</Text>
      <Text style={styles.label}>Observaciones (opcional)</Text>
      <TextInput style={[styles.input, styles.textArea]} value={observations} onChangeText={setObservations} editable={Boolean(selected)} multiline placeholder="Observaciones de la recolección" />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !selected }} style={[styles.deliverySubmit, !selected && styles.buttonDisabled]} disabled={!selected} onPress={register}>
        <Text style={styles.primaryText}>Registrar recolección de café</Text>
      </TouchableOpacity>
    </View>

    <Text style={styles.section}>Recolecciones del día</Text>
    <View style={styles.grid}>{deliveries.map((delivery) => <View style={styles.card} key={delivery.id_entrega}>
      <Text style={styles.cardTitle}>{tonnes(delivery.cantidad_kg)} · {delivery.estado_entrega}</Text>
      <Text>Caficultor: #{delivery.caficultor_id}</Text>
      <Text>Fecha: {formatDate(delivery.fecha_hora_entrega)}</Text>
      {delivery.observaciones ? <Text>Observaciones: {delivery.observaciones}</Text> : null}
      {history[delivery.id_entrega]?.length ? <View style={styles.history}><Text style={styles.label}>Último cambio</Text><Text>{history[delivery.id_entrega][0].estado_anterior} → {history[delivery.id_entrega][0].estado_nuevo} · {history[delivery.id_entrega][0].usuario_nombre} · {formatDate(history[delivery.id_entrega][0].fecha_hora_cambio)}</Text></View> : <Text style={styles.muted}>Aún no hay cambios de estado.</Text>}
    </View>)}</View>
    {!deliveries.length ? <Text style={styles.muted}>Aún no hay recolecciones registradas.</Text> : null}
    <Text style={styles.muted}>El listado se actualiza automáticamente cada 15 segundos.</Text><TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar listado</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
