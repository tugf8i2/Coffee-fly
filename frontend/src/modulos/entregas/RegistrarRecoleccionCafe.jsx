import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { fetchDeliveryHistories } from '../../servicios/historialEntregas';
import { bagSummary, tonnes, weight } from '../../servicios/presentacionCarga';
import { styles as defaultStyles } from './RegistrarRecoleccionCafe.styles';
import { coordinatorModuleStyles } from '../coordinador/Coordinador.styles';
import { apiErrorMessage } from '../../servicios/mensajesApi';

const formatDate = (value) => new Date(value).toLocaleString();

export default function RegistrarRecoleccionCafe({ go, token, user, initialRequestId }) {
  const styles = Platform.OS === 'web' && user?.rol === 'coordinador' ? { ...defaultStyles, ...coordinatorModuleStyles } : defaultStyles;
  const [requests, setRequests] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [observations, setObservations] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState({});
  const [saving, setSaving] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const savingRef = useRef(false);
  const cancelingRef = useRef(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestsResponse, deliveriesResponse] = await Promise.all([
        fetchApi(`${API_BASE_URL}/entregas/solicitudes-activas`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/`, { headers }),
      ]);
      const [requestsData, deliveriesData] = await Promise.all([requestsResponse.json(), deliveriesResponse.json()]);
      if (!requestsResponse.ok) throw Error(apiErrorMessage(requestsData, 'No se pudieron consultar las solicitudes activas.'));
      if (!deliveriesResponse.ok) throw Error(apiErrorMessage(deliveriesData, 'No se pudieron consultar las entregas.'));
      setRequests(requestsData);
      setSelected((current) => current
        ? requestsData.find((request) => request.id_solicitud === current.id_solicitud) || null
        : requestsData.find((request) => request.id_solicitud === initialRequestId) || null);
      setDeliveries(deliveriesData);
      setHistory(await fetchDeliveryHistories(deliveriesData, token));
    } catch (reason) {
      setError(reason.message);
    }
  }, [token, initialRequestId]);

  usePolling(load, 15000);

  const register = async () => {
    if (savingRef.current) return;
    if (!selected) return setError('Selecciona una solicitud activa para registrar la recolección.');
    savingRef.current = true;
    setSaving(true);
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
      if (!response.ok) throw Error(apiErrorMessage(result, 'No se pudo registrar la recolección.'));
      setMessage('Recolección de café registrada con estado Pendiente.');
      setSelected(null);
      setObservations('');
      await load();
    } catch (reason) {
      setError(reason.message);
    } finally { savingRef.current = false; setSaving(false); }
  };

  const confirmCancellation = (delivery) => {
    const prompt = `¿Cancelar la recolección ${delivery.id_entrega.slice(0, 8)}? La solicitud quedará cancelada y no podrá asignarse.`;
    if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(prompt) ?? false);
    return new Promise((resolve) => Alert.alert('Cancelar recolección', prompt, [
      { text: 'Conservar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
  };

  const cancelDelivery = async (delivery) => {
    const reason = cancelReason.trim();
    if (reason.length < 10) return setError('Explica el motivo de cancelación con al menos 10 caracteres.');
    if (cancelingRef.current || !(await confirmCancellation(delivery))) return;
    cancelingRef.current = delivery.id_entrega;
    setCancelingId(delivery.id_entrega);
    setError('');
    setMessage('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/${delivery.id_entrega}/cancelar`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: reason }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(result, 'No se pudo cancelar la recolección.'));
      setMessage(delivery.estado_entrega === 'en camino' ? 'Carga en camino cancelada y operación actualizada correctamente.' : 'Recolección cancelada correctamente.');
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } catch (reason) { setError(reason.message); }
    finally { cancelingRef.current = null; setCancelingId(null); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.deliveryHeader}>
      <Text style={styles.title}>Registrar recolección de café</Text>
      <Text style={styles.muted}>Selecciona una solicitud activa del caficultor y confirma la recolección. La asignación de vehículo se realiza posteriormente.</Text>
    </View>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    {message ? <FeedbackMessage type="success">{message}</FeedbackMessage> : null}

    <Text style={styles.section}>Solicitudes activas</Text>
    <View style={styles.grid}>{requests.map((request) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selected?.id_solicitud === request.id_solicitud, disabled: saving }} disabled={saving} key={request.id_solicitud} style={[styles.card, selected?.id_solicitud === request.id_solicitud && styles.cardSelected]} onPress={() => setSelected(request)}>
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
      <TouchableOpacity dataSet={{ coordinatorDeliverySubmit: 'true' }} accessibilityRole="button" accessibilityState={{ disabled: !selected || saving, busy: saving }} style={[styles.deliverySubmit, (!selected || saving) && styles.buttonDisabled]} disabled={!selected || saving} onPress={register}>
        <Text style={styles.primaryText}>{saving ? 'Registrando recolección…' : 'Registrar recolección de café'}</Text>
      </TouchableOpacity>
    </View>

    <Text style={styles.section}>Recolecciones del día</Text>
    <View style={styles.grid}>{deliveries.map((delivery) => <View style={styles.card} key={delivery.id_entrega}>
      <Text style={styles.cardTitle}>{tonnes(delivery.cantidad_kg)} · {delivery.estado_entrega}</Text>
      <Text>Caficultor: #{delivery.caficultor_id}</Text>
      <Text>Fecha: {formatDate(delivery.fecha_hora_entrega)}</Text>
      {delivery.observaciones ? <Text>Observaciones: {delivery.observaciones}</Text> : null}
      {delivery.motivo_cancelacion ? <Text style={styles.error}>Motivo de cancelación: {delivery.motivo_cancelacion}</Text> : null}
      {history[delivery.id_entrega]?.length ? <View style={styles.history}><Text style={styles.label}>Último cambio</Text><Text>{history[delivery.id_entrega][0].estado_anterior} → {history[delivery.id_entrega][0].estado_nuevo} · {history[delivery.id_entrega][0].usuario_nombre} · {formatDate(history[delivery.id_entrega][0].fecha_hora_cambio)}</Text></View> : <Text style={styles.muted}>Aún no hay cambios de estado.</Text>}
      {['pendiente', 'en camino'].includes(delivery.estado_entrega) ? cancelTarget === delivery.id_entrega ? <View style={styles.formCard}>
        <Text style={styles.label}>{delivery.estado_entrega === 'en camino' ? 'Motivo obligatorio para cancelar la carga en camino' : 'Motivo de cancelación'}</Text>
        <TextInput accessibilityLabel="Motivo de cancelación" style={[styles.input, styles.textArea]} value={cancelReason} onChangeText={setCancelReason} multiline maxLength={500} placeholder="Explica claramente por qué debe cancelarse esta carga" />
        <Text style={styles.muted}>{cancelReason.trim().length}/500 · mínimo 10 caracteres</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: Boolean(cancelingId) || cancelReason.trim().length < 10, busy: cancelingId === delivery.id_entrega }} disabled={Boolean(cancelingId) || cancelReason.trim().length < 10} style={[styles.primary, (cancelingId || cancelReason.trim().length < 10) && styles.buttonDisabled]} onPress={() => cancelDelivery(delivery)}><Text style={styles.primaryText}>{cancelingId === delivery.id_entrega ? 'Cancelando…' : 'Confirmar cancelación'}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={Boolean(cancelingId)} style={styles.secondary} onPress={() => { setCancelTarget(null); setCancelReason(''); }}><Text style={styles.secondaryText}>Conservar carga</Text></TouchableOpacity>
      </View> : <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: Boolean(cancelingId) }} disabled={Boolean(cancelingId)} style={[styles.secondary, cancelingId && styles.buttonDisabled]} onPress={() => { setCancelTarget(delivery.id_entrega); setCancelReason(''); setError(''); }}><Text style={styles.error}>{delivery.estado_entrega === 'en camino' ? 'Cancelar carga en camino' : 'Cancelar recolección'}</Text></TouchableOpacity> : null}
    </View>)}</View>
    {!deliveries.length ? <Text style={styles.muted}>Aún no hay recolecciones registradas.</Text> : null}
    <Text style={styles.muted}>El listado se actualiza automáticamente cada 15 segundos.</Text><TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar listado</Text></TouchableOpacity>
  </ScrollView>;
}
