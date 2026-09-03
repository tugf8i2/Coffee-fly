import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../config';
import usePolling from '../hooks/usePolling';

export default function EventMessageInbox({ token, styles }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/eventos/notificaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudieron consultar los mensajes.');
      setMessages(data);
      setError('');
    } catch (reason) { setError(reason.message); }
  }, [token]);
  usePolling(load, 8000);

  return <View>
    <TouchableOpacity style={styles.primary} onPress={() => setOpen((current) => !current)}>
      <Text style={styles.primaryText}>Mensajes de ruta ({messages.length}) {open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
    {open ? <View style={{ width: '100%', maxWidth: 390, alignSelf: 'center', backgroundColor: '#18251d', borderRadius: 30, padding: 9, marginTop: 10 }}>
      <View style={{ backgroundColor: '#f7f8ef', borderRadius: 23, padding: 16, minHeight: 280, gap: 10 }}>
        <View style={{ width: 76, height: 5, borderRadius: 3, backgroundColor: '#526451', alignSelf: 'center', marginBottom: 6 }} />
        <Text style={styles.cardTitle}>Centro de mensajes</Text>
        <Text style={styles.muted}>Novedades enviadas por los conductores</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {messages.map((message) => <View key={message.id_evento} style={{ backgroundColor: '#dce8b4', borderRadius: 14, padding: 12, gap: 3 }}>
          <Text style={styles.label}>{message.descripcion_evento}</Text>
          <Text>Conductor: {message.conductor_nombre}</Text>
          <Text>Vehículo: {message.vehiculo_placa || 'Sin placa'}</Text>
          <Text style={styles.muted}>{new Date(message.fecha_hora_evento).toLocaleString()}</Text>
        </View>)}
        {!messages.length && !error ? <Text style={styles.muted}>No hay novedades reportadas.</Text> : null}
        <TouchableOpacity onPress={load}><Text style={styles.link}>Actualizar mensajes</Text></TouchableOpacity>
      </View>
    </View> : null}
  </View>;
}
