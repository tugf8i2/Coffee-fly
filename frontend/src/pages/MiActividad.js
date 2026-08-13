import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config/Api';

const states = { pendiente: 'Pendiente', 'en camino': 'En camino', entregado: 'Entregado', cancelado: 'Cancelada' };

export default function MiActividad({ go, token, styles }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/solicitudes/mis-solicitudes`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw Error(result.detail || 'No se pudo cargar tu actividad.');
      setData(result);
    } catch (reason) { setError(reason.message); }
  };

  useEffect(() => { load(); }, []);
  const summary = data?.resumen;
  const requestCard = (request) => <View style={styles.card} key={request.id_solicitud}>
    <Text style={styles.cardTitle}>{states[request.estado_solicitud] || request.estado_solicitud}</Text>
    <Text style={styles.muted}>{request.peso_kg} kg · {new Date(request.fecha_hora_solicitud).toLocaleDateString()}</Text>
    {request.observacion ? <Text>{request.observacion}</Text> : null}
  </View>;

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Mi actividad cafetera</Text>
    <Text style={styles.muted}>Resumen personal de solicitudes y despachos.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!data && !error ? <Text style={styles.muted}>Cargando actividad...</Text> : null}
    {summary ? <>
      <View style={styles.card}><Text style={styles.cardTitle}>Resumen del período</Text>
        <Text>Solicitudes registradas: {summary.total_solicitudes}</Text>
        <Text>Solicitudes activas: {summary.solicitudes_activas}</Text>
        <Text>Despachos entregados: {summary.despachos_entregados}</Text>
        <Text>Kilogramos solicitados: {summary.kg_solicitados} kg</Text>
        <Text>Kilogramos despachados: {summary.kg_despachados} kg</Text>
      </View>
      <Text style={styles.section}>Solicitudes activas</Text>
      {data.solicitudes_activas.length ? data.solicitudes_activas.map(requestCard) : <Text style={styles.muted}>No tienes solicitudes activas.</Text>}
      <Text style={styles.section}>Historial de despachos</Text>
      {data.historial_despachos.length ? data.historial_despachos.map(requestCard) : <Text style={styles.muted}>Aún no tienes despachos entregados.</Text>}
    </> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar resumen</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
