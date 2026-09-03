import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../config';
import usePolling from '../hooks/usePolling';

export default function EventMessageInbox({ token, styles, role }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [collectionFilter, setCollectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);

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
  usePolling(load, 15000);
  const collections = [...new Map(messages.map((message) => [message.entrega_id, message])).values()];
  const visibleMessages = messages.filter((message) => (
    (!collectionFilter || message.entrega_id === collectionFilter)
    && (!statusFilter || message.estado_recoleccion === statusFilter)
  ));
  const selectedCollection = collections.find((message) => message.entrega_id === collectionFilter);

  const remove = async (eventId) => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/eventos/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo eliminar el mensaje.');
      setPendingDelete(null);
      await load();
    } catch (reason) { setError(reason.message); }
  };

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
        <Text style={styles.label}>Filtrar por recolección</Text>
        <TouchableOpacity style={styles.statusButton} onPress={() => setCollectionMenuOpen((current) => !current)}>
          <Text style={styles.statusButtonText}>{selectedCollection ? `${selectedCollection.caficultor_nombre} · ${selectedCollection.carga_id.slice(0, 8)}` : 'Todas las recolecciones'} ▾</Text>
        </TouchableOpacity>
        {collectionMenuOpen ? <View style={{ gap: 9 }}>
          <TouchableOpacity onPress={() => { setCollectionFilter(''); setCollectionMenuOpen(false); }}><Text style={styles.link}>Todas las recolecciones</Text></TouchableOpacity>
          {collections.map((message) => <TouchableOpacity key={message.entrega_id} onPress={() => { setCollectionFilter(message.entrega_id); setCollectionMenuOpen(false); }}><Text style={styles.link}>{message.caficultor_nombre} · {message.carga_id.slice(0, 8)}</Text></TouchableOpacity>)}
        </View> : null}
        <Text style={styles.label}>Filtrar por estado</Text>
        <View style={styles.statusActions}>
          {[['', 'Todos'], ['pendiente', 'Pendiente'], ['en camino', 'En camino'], ['entregado', 'Entregado'], ['cancelado', 'Cancelado']].map(([value, label]) => <TouchableOpacity key={label} style={[styles.role, statusFilter === value && styles.roleActive]} onPress={() => setStatusFilter(value)}><Text>{label}</Text></TouchableOpacity>)}
        </View>
        {visibleMessages.map((message) => <View key={message.id_evento} style={{ backgroundColor: '#dce8b4', borderRadius: 14, padding: 12, gap: 3 }}>
          <Text style={styles.label}>{message.tipo_evento.toUpperCase()}</Text>
          <Text>{message.descripcion_evento}</Text>
          <Text style={{ fontWeight: '700' }}>Carga de: {message.caficultor_nombre}</Text>
          <Text>Peso de carga: {message.carga_peso_kg.toLocaleString('es-CO')} kg</Text>
          <Text style={styles.muted}>Carga: {message.carga_id.slice(0, 8)}</Text>
          <Text>Estado: {message.estado_recoleccion}</Text>
          <Text>Conductor: {message.conductor_nombre}</Text>
          <Text>Vehículo: {message.vehiculo_placa || 'Sin placa'}</Text>
          <Text style={styles.muted}>{new Date(message.fecha_hora_evento).toLocaleString()}</Text>
          {role === 'coordinador' ? pendingDelete === message.id_evento ? <View style={{ gap: 7, marginTop: 6 }}>
            <Text style={styles.error}>¿Eliminar este mensaje para todos?</Text>
            <TouchableOpacity onPress={() => remove(message.id_evento)}><Text style={styles.error}>Sí, eliminar</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setPendingDelete(null)}><Text style={styles.link}>Cancelar</Text></TouchableOpacity>
          </View> : <TouchableOpacity onPress={() => setPendingDelete(message.id_evento)}><Text style={styles.error}>Eliminar mensaje</Text></TouchableOpacity> : null}
        </View>)}
        {!visibleMessages.length && !error ? <Text style={styles.muted}>No hay novedades para estos filtros.</Text> : null}
        <TouchableOpacity onPress={load}><Text style={styles.link}>Actualizar mensajes</Text></TouchableOpacity>
      </View>
    </View> : null}
  </View>;
}
