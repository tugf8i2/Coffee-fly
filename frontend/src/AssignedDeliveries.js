import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from './config';
import usePolling from './hooks/usePolling';
import { detenerRastreoSegundoPlano } from './services/backgroundLocation';
import { fetchDeliveryHistories } from './services/deliveryHistory';
import { enviarOSolicitarEnCola, sincronizarPendientes } from './services/offline';

const labels = { pendiente: 'Pendiente', 'en camino': 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' };
const formatDate = (value) => new Date(value).toLocaleString();

export default function AssignedDeliveries({ go, token, styles }) {
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetchApi(`${API_BASE_URL}/entregas/mis-asignadas`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudieron consultar tus entregas asignadas.');
      setDeliveries(data);
      setHistory(await fetchDeliveryHistories(data, token));
    } catch (reason) { setError(reason.message); }
  }, [token]);

  usePolling(load, 15000);

  const changeStatus = async (delivery, estado_entrega) => {
    setError(''); setMessage('');
    try {
      const result = await enviarOSolicitarEnCola('estado_entrega', { entrega_id: delivery.id_entrega, estado_entrega, fecha: new Date().toISOString() }, token);
      setMessage(result.offline
        ? `Sin conexión: el cambio a ${labels[estado_entrega]} quedó guardado y se sincronizará automáticamente.`
        : `Entrega actualizada a ${labels[estado_entrega]}.`);
      if (['entregado', 'cancelado'].includes(estado_entrega)) await detenerRastreoSegundoPlano();
      if (!result.offline) await load();
    } catch (reason) { setError(reason.message); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Mis entregas asignadas</Text>
    <Text style={styles.muted}>Los cambios se guardan sin conexión y se sincronizan automáticamente al recuperar internet. Una entrega cancelada queda bloqueada.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    {deliveries.map((delivery) => <View key={delivery.id_entrega} style={styles.card}>
      <Text style={styles.cardTitle}>{delivery.caficultor_nombre} · {delivery.cantidad_kg} kg</Text>
      <Text>Vehículo: {delivery.vehiculo_placa}</Text>
      <Text>Estado actual: {labels[delivery.estado_entrega]}</Text>
      <Text>Registrada: {formatDate(delivery.fecha_hora_entrega)}</Text>
      {delivery.estado_entrega !== 'cancelado' ? <View style={styles.statusActions}>
        {Object.entries(labels).filter(([value]) => (delivery.estado_entrega === 'pendiente' ? ['en camino', 'cancelado'] : delivery.estado_entrega === 'en camino' ? ['entregado', 'cancelado'] : []).includes(value)).map(([value, label]) => <TouchableOpacity key={value} style={styles.statusButton} onPress={() => changeStatus(delivery, value)}><Text style={styles.statusButtonText}>{label}</Text></TouchableOpacity>)}
      </View> : <Text style={styles.error}>Esta entrega fue cancelada y no puede modificarse.</Text>}
      {history[delivery.id_entrega]?.length ? <View style={styles.history}><Text style={styles.label}>Trazabilidad</Text>{history[delivery.id_entrega].map((item) => <Text key={item.id_historial}>{labels[item.estado_anterior]} → {labels[item.estado_nuevo]} · {item.usuario_nombre} · {formatDate(item.fecha_hora_cambio)}</Text>)}</View> : <Text style={styles.muted}>Sin cambios de estado registrados.</Text>}
    </View>)}
    {!deliveries.length ? <Text style={styles.muted}>No tienes entregas asignadas.</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={async () => { const resultado = await sincronizarPendientes(token); setMessage(resultado.sincronizadas ? `${resultado.sincronizadas} cambio(s) sincronizado(s).` : 'No hay cambios pendientes para sincronizar.'); await load(); }}><Text style={styles.primaryText}>Sincronizar y actualizar</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
