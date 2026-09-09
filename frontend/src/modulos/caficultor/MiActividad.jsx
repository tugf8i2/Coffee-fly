import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion/ClienteApi';
import usePolling from '../../ganchos/usarSondeo';
import { bagSummary, tonnes, weight } from '../../servicios/presentacionCarga';
import { styles } from './MiActividad.styles';

const states = { pendiente: 'Pendiente', 'en camino': 'En camino', entregado: 'Entregado', cancelado: 'Cancelada' };

export default function MiActividad({ go, token }) {
  const [data, setData] = useState(null);
  const [eventsByDelivery, setEventsByDelivery] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [response, eventsResponse] = await Promise.all([
        fetchApi(`${API_BASE_URL}/solicitudes/mis-solicitudes`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/eventos/notificaciones`, { headers }),
      ]);
      const [result, events] = await Promise.all([response.json(), eventsResponse.json()]);
      if (!response.ok) throw Error(result.detail || 'No se pudo cargar tu actividad.');
      if (!eventsResponse.ok) throw Error(events.detail || 'No se pudo cargar el historial de eventos.');
      const groupedEvents = {};
      events.forEach((event) => {
        if (!groupedEvents[event.entrega_id]) groupedEvents[event.entrega_id] = [];
        groupedEvents[event.entrega_id].push(event);
      });
      setData(result);
      setEventsByDelivery(groupedEvents);
      setError('');
    } catch (reason) { setError(reason.message); }
  }, [token]);

  usePolling(load, 30000);
  const summary = data?.resumen;
  const requestCard = (request) => {
    const events = eventsByDelivery[request.entrega_id] || [];
    return <View style={styles.card} key={request.id_solicitud}>
    <Text style={styles.cardTitle}>{states[request.estado_solicitud] || request.estado_solicitud}</Text>
    {request.carga_id ? <Text style={styles.muted}>Carga: {request.carga_id.slice(0, 8)}</Text> : null}
    <Text style={styles.totalValue}>{tonnes(request.peso_kg)}</Text>
    {bagSummary(request) ? <Text>{bagSummary(request)}</Text> : null}
    <Text style={styles.muted}>{weight(request.peso_kg)} · {new Date(request.fecha_hora_solicitud).toLocaleDateString()}</Text>
    {request.observacion ? <Text>{request.observacion}</Text> : null}
    {request.entrega_id ? <View style={{ borderTopWidth: 1, borderTopColor: '#d6ddce', marginTop: 10, paddingTop: 10, gap: 8 }}>
      <Text style={styles.cardTitle}>Historial de eventos</Text>
      <Text style={styles.muted}>Mensajes del conductor asignado únicamente a esta carga.</Text>
      {events.map((event) => <View key={event.id_evento} style={{ borderLeftWidth: 3, borderLeftColor: '#6A994E', paddingLeft: 9 }}>
        <Text style={styles.label}>{event.tipo_evento.toUpperCase()}</Text>
        <Text>{event.descripcion_evento}</Text>
        <Text>Conductor: {event.conductor_nombre}</Text>
        <Text>Vehículo: {event.vehiculo_placa || 'Sin placa'}</Text>
        <Text style={styles.muted}>{new Date(event.fecha_hora_evento).toLocaleString()}</Text>
      </View>)}
      {!events.length ? <Text style={styles.muted}>Esta carga todavía no tiene eventos reportados.</Text> : null}
    </View> : <Text style={styles.muted}>El historial aparecerá cuando se asigne la recolección.</Text>}
  </View>;
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Mi actividad cafetera</Text>
    <Text style={styles.muted}>Resumen personal de solicitudes y despachos. Se actualiza automáticamente cada 30 segundos.</Text>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    {!data && !error ? <Text style={styles.muted}>Cargando actividad...</Text> : null}
    {summary ? <>
      <View style={styles.card}><Text style={styles.cardTitle}>Resumen del período</Text>
        <Text>Solicitudes registradas: {summary.total_solicitudes}</Text>
        <Text>Solicitudes activas: {summary.solicitudes_activas}</Text>
        <Text>Despachos entregados: {summary.despachos_entregados}</Text>
        <Text>Peso solicitado: {tonnes(summary.kg_solicitados)}</Text>
        <Text>Peso despachado: {tonnes(summary.kg_despachados)}</Text>
      </View>
      <Text style={styles.section}>Solicitudes activas</Text>
      {data.solicitudes_activas.length ? <View style={styles.grid}>{data.solicitudes_activas.map(requestCard)}</View> : <Text style={styles.muted}>No tienes solicitudes activas.</Text>}
      <Text style={styles.section}>Historial de despachos</Text>
      {data.historial_despachos.length ? <View style={styles.grid}>{data.historial_despachos.map(requestCard)}</View> : <Text style={styles.muted}>Aún no tienes despachos entregados.</Text>}
    </> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar resumen</Text></TouchableOpacity>
  </ScrollView>;
}
