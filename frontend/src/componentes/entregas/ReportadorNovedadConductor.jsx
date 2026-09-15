import FeedbackMessage from '../comunes/MensajeRetroalimentacion';
import SelectorFormulario from '../comunes/SelectorFormulario';
import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';

const options = [
  ['inicio del viaje', 'Inicio del viaje'],
  ['retraso', 'Retraso'],
  ['llegada', 'Llegada al punto de recolección'],
  ['inconveniente', 'Inconveniente'],
  ['entrega realizada', 'Entrega realizada'],
  ['daño vehicular', 'Daño vehicular'],
  ['parada baño', 'Parada para ir al baño'],
  ['imprevisto nuevo', 'Nuevo imprevisto'],
];

export default function ReportadorNovedadConductor({ deliveryId, token, styles }) {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    if (!deliveryId) return;
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/${deliveryId}/eventos-conductor`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo consultar el historial de eventos.');
      setEvents(data);
    } catch (reason) { setError(reason.message); }
  };
  useEffect(() => { load(); }, [deliveryId]);

  const report = async () => {
    if (!selected || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/${deliveryId}/eventos-conductor`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_evento: selected, detalle: detail.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo notificar el evento.');
      setMessage('Evento notificado correctamente al sistema.');
      setSelected(''); setDetail('');
      await load();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  };

  // Este formulario está en una columna: no debe heredar el flexBasis de las tarjetas de cuadrícula.
  return <View style={[styles.fullCard, { flexShrink: 0 }]}>
    <Text style={styles.cardTitle}>Notificar evento del viaje</Text>
    <Text style={styles.muted}>Reporta una novedad mientras recorres la ruta.</Text>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    {message ? <FeedbackMessage type="success">{message}</FeedbackMessage> : null}
    <Text style={styles.label}>Tipo de evento</Text>
    <SelectorFormulario label="Tipo de evento" value={selected} onValueChange={setSelected} options={options} placeholder="Selecciona un evento" disabled={saving} />
    {selected ? <>
      <Text style={styles.label}>Detalle opcional</Text>
      <TextInput style={[styles.input, styles.textArea]} value={detail} onChangeText={setDetail} maxLength={250} multiline placeholder="Describe brevemente lo ocurrido" />
      <TouchableOpacity style={[styles.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={report}><Text style={styles.primaryText}>{saving ? 'Notificando…' : 'Notificar evento'}</Text></TouchableOpacity>
    </> : null}
    <Text style={styles.label}>Historial reciente</Text>
    {events.map((event) => <View key={event.id_evento} style={{ borderLeftWidth: 3, borderLeftColor: '#6A994E', paddingLeft: 9, marginBottom: 6 }}>
      <Text style={styles.label}>{event.tipo_evento}</Text>
      <Text>{event.descripcion_evento}</Text>
      <Text style={styles.muted}>{new Date(event.fecha_hora_evento).toLocaleString()}</Text>
    </View>)}
    {!events.length ? <Text style={styles.muted}>No has notificado eventos en esta entrega.</Text> : null}
  </View>;
}
