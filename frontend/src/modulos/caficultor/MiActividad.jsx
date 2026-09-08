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
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/solicitudes/mis-solicitudes`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw Error(result.detail || 'No se pudo cargar tu actividad.');
      setData(result);
    } catch (reason) { setError(reason.message); }
  }, [token]);

  usePolling(load, 30000);
  const summary = data?.resumen;
  const requestCard = (request) => <View style={styles.card} key={request.id_solicitud}>
    <Text style={styles.cardTitle}>{states[request.estado_solicitud] || request.estado_solicitud}</Text>
    <Text style={styles.totalValue}>{tonnes(request.peso_kg)}</Text>
    {bagSummary(request) ? <Text>{bagSummary(request)}</Text> : null}
    <Text style={styles.muted}>{weight(request.peso_kg)} · {new Date(request.fecha_hora_solicitud).toLocaleDateString()}</Text>
    {request.observacion ? <Text>{request.observacion}</Text> : null}
  </View>;

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
