import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import FotoConductor from '../../componentes/comunes/FotoConductor';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion/ClienteApi';
import usePolling from '../../ganchos/usarSondeo';
import { bagSummary, tonnes, weight } from '../../servicios/presentacionCarga';
import { styles } from './MiActividad.styles';
import { apiErrorMessage } from '../../servicios/mensajesApi';

const states = { pendiente: 'Pendiente', 'en camino': 'En camino', entregado: 'Entregado', cancelado: 'Cancelada' };

export default function MiActividad({ go, token }) {
  const [data, setData] = useState(null);
  const [eventsByDelivery, setEventsByDelivery] = useState({});
  const [error, setError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [message, setMessage] = useState('');
  const [cancelingId, setCancelingId] = useState(null);
  const cancelingRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestOutcome, eventsOutcome] = await Promise.allSettled([
        fetchApi(`${API_BASE_URL}/solicitudes/mis-solicitudes`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/eventos/notificaciones`, { headers }),
      ]);
      if (requestOutcome.status === 'rejected') throw requestOutcome.reason;
      const response = requestOutcome.value;
      const result = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(result, 'No se pudo cargar tu actividad.'));
      setData(result);
      setError('');
      if (eventsOutcome.status === 'rejected') {
        setEventsError(`${eventsOutcome.reason.message || 'No se pudo consultar el historial de eventos.'} Las solicitudes siguen disponibles.`);
        return;
      }
      const eventsResponse = eventsOutcome.value;
      let events;
      try {
        events = await eventsResponse.json();
      } catch {
        setEventsError('El historial de eventos devolvió una respuesta inválida. Las solicitudes siguen disponibles.');
        return;
      }
      if (!eventsResponse.ok || !Array.isArray(events)) {
        setEventsError(apiErrorMessage(events, 'No se pudo cargar el historial de eventos. Las solicitudes siguen disponibles.'));
        return;
      }
      const groupedEvents = {};
      events.forEach((event) => {
        if (!groupedEvents[event.entrega_id]) groupedEvents[event.entrega_id] = [];
        groupedEvents[event.entrega_id].push(event);
      });
      setEventsByDelivery(groupedEvents);
      setEventsError('');
    } catch (reason) { setError(reason.message); }
  }, [token]);

  usePolling(load, 30000);
  const summary = data?.resumen;
  const confirmCancellation = (request) => {
    const prompt = `¿Cancelar la solicitud ${request.id_solicitud.slice(0, 8)}? Esta acción no se puede deshacer.`;
    if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(prompt) ?? false);
    return new Promise((resolve) => Alert.alert('Cancelar solicitud', prompt, [
      { text: 'Conservar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Cancelar solicitud', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
  };
  const cancelRequest = async (request) => {
    if (cancelingRef.current || !(await confirmCancellation(request))) return;
    cancelingRef.current = request.id_solicitud;
    setCancelingId(request.id_solicitud);
    try {
      const response = await fetchApi(`${API_BASE_URL}/solicitudes/${request.id_solicitud}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_solicitud: 'cancelado' }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(result, 'No se pudo cancelar la solicitud.'));
      setMessage('Solicitud cancelada correctamente.');
      await load();
    } catch (reason) { setError(reason.message); }
    finally { cancelingRef.current = null; setCancelingId(null); }
  };
  const requestCard = (request) => {
    const events = eventsByDelivery[request.entrega_id] || [];
    return <View style={styles.card} key={request.id_solicitud}>
    <Text style={styles.cardTitle}>{states[request.estado_solicitud] || request.estado_solicitud}</Text>
    {request.carga_id ? <Text style={styles.muted}>Carga: {request.carga_id.slice(0, 8)}</Text> : null}
    <Text style={styles.totalValue}>{tonnes(request.peso_kg)}</Text>
    {bagSummary(request) ? <Text>{bagSummary(request)}</Text> : null}
    <Text style={styles.muted}>{weight(request.peso_kg)} · {new Date(request.fecha_hora_solicitud).toLocaleDateString()}</Text>
    {request.conductor_nombre ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 }}>
      <FotoConductor foto={request.conductor_foto_perfil} nombre={request.conductor_nombre} />
      <Text>Conductor asignado: {request.conductor_nombre}</Text>
    </View> : null}
    {request.observacion ? <Text>{request.observacion}</Text> : null}
    {request.estado_solicitud === 'pendiente' ? <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(cancelingId), busy: cancelingId === request.id_solicitud }}
      disabled={Boolean(cancelingId)}
      style={[styles.secondary, cancelingId && styles.buttonDisabled]}
      onPress={() => cancelRequest(request)}
    ><Text style={styles.secondaryText}>{cancelingId === request.id_solicitud ? 'Cancelando…' : 'Cancelar solicitud pendiente'}</Text></TouchableOpacity> : null}
    {request.entrega_id ? <View style={{ borderTopWidth: 1, borderTopColor: '#d6ddce', marginTop: 10, paddingTop: 10, gap: 8 }}>
      <Text style={styles.cardTitle}>Historial de eventos</Text>
      <Text style={styles.muted}>Mensajes del conductor asignado únicamente a esta carga.</Text>
      {events.map((event) => <View key={event.id_evento} style={{ borderLeftWidth: 3, borderLeftColor: '#6A994E', paddingLeft: 9 }}>
        <Text style={styles.label}>{event.tipo_evento.toUpperCase()}</Text>
        <Text>{event.descripcion_evento}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><FotoConductor foto={event.conductor_foto_perfil} nombre={event.conductor_nombre} size={34}/><Text>Conductor: {event.conductor_nombre}</Text></View>
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
    {eventsError ? <FeedbackMessage type="warning">{eventsError}</FeedbackMessage> : null}
    {message ? <FeedbackMessage type="success">{message}</FeedbackMessage> : null}
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
    <TouchableOpacity accessibilityRole="button"onPress={load}
    style={[
    styles.primary, 
    { 
      width: '100%', 
      backgroundColor: '#064c3b', 
      minHeight: 45, 
      paddingVertical: 10,
      borderRadius: 8, 
      justifyContent: 'center', 
      alignItems: 'center',
      marginTop: 15,
      cursor: 'pointer'}]}>
        <Text style={[styles.primaryText, { color: '#ffffff', fontWeight: '700', fontSize: 15 }]}>Actualizar resumen</Text>
        </TouchableOpacity>

  </ScrollView>;
}
