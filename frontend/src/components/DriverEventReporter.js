import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../config';

const options = [
  ['daño vehicular', 'Daño vehicular'],
  ['parada baño', 'Parada para ir al baño'],
  ['imprevisto nuevo', 'Nuevo imprevisto'],
];

export default function DriverEventReporter({ deliveryId, token, styles }) {
  const [events, setEvents] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
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
      setSelected(''); setDetail(''); setMenuOpen(false);
      await load();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  };
  const selectedLabel = options.find(([value]) => value === selected)?.[1];

  return <View style={styles.card}>
    <Text style={styles.cardTitle}>Notificar evento del viaje</Text>
    <Text style={styles.muted}>Reporta una novedad mientras recorres la ruta.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    <TouchableOpacity style={styles.statusButton} onPress={() => setMenuOpen((open) => !open)}>
      <Text style={styles.statusButtonText}>{selectedLabel || 'Seleccionar tipo de evento'} ▾</Text>
    </TouchableOpacity>
    {menuOpen ? <View style={styles.card}>
      {options.map(([value, label]) => <TouchableOpacity key={value} onPress={() => { setSelected(value); setMenuOpen(false); }}><Text style={styles.link}>{label}</Text></TouchableOpacity>)}
    </View> : null}
    {selected ? <>
      <Text style={styles.label}>Detalle opcional</Text>
      <TextInput style={[styles.input, styles.textArea]} value={detail} onChangeText={setDetail} maxLength={75} multiline placeholder="Describe brevemente lo ocurrido" />
      <TouchableOpacity style={[styles.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={report}><Text style={styles.primaryText}>{saving ? 'Notificando…' : 'Notificar evento'}</Text></TouchableOpacity>
    </> : null}
    <Text style={styles.label}>Historial reciente</Text>
    {events.map((event) => <Text key={event.id_evento}>{event.descripcion_evento} · {new Date(event.fecha_hora_evento).toLocaleString()}</Text>)}
    {!events.length ? <Text style={styles.muted}>No has notificado eventos en esta entrega.</Text> : null}
  </View>;
}
