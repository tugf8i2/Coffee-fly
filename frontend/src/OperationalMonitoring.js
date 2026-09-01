import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from './config';
import FleetMap from './components/FleetMap';
import usePolling from './hooks/usePolling';

const labels = {
  actualizado: 'GPS actualizado',
  desactualizado: 'GPS atrasado',
  sin_ubicacion: 'Sin ubicación GPS',
};

export default function OperationalMonitoring({ go, token, styles }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi(`${API_BASE_URL}/monitoreo/resumen`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'No fue posible consultar el monitoreo.');
      setSummary(data);
      setError('');
    } catch (reason) {
      setError(reason.message || 'No fue posible consultar el monitoreo.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  usePolling(load, 15000);

  const counters = summary?.metricas_proceso?.contadores || {};
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Monitoreo operativo</Text>
    <Text style={styles.muted}>Mapa general y estado GPS de las entregas en camino. Se actualiza cada 15 segundos; el detalle usa canal en vivo.</Text>
    {loading && !summary ? <Text style={styles.muted}>Consultando…</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {summary ? <>
      <View style={styles.metric}><Text style={styles.metricLabel}>Vehículos en camino</Text><Text style={styles.metricValue}>{summary.vehiculos_en_camino}</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>GPS actualizado</Text><Text style={styles.metricValue}>{summary.vehiculos_actualizados}</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>GPS atrasado o ausente</Text><Text style={styles.metricValue}>{summary.vehiculos_desactualizados + summary.vehiculos_sin_ubicacion}</Text></View>
      <Text style={styles.section}>Mapa de flota</Text>
      <FleetMap vehicles={summary.vehiculos} />
      <Text style={styles.section}>Vehículos</Text>
      {summary.vehiculos.length === 0 ? <Text style={styles.muted}>No hay entregas en camino.</Text> : summary.vehiculos.map((vehicle) => <View key={vehicle.entrega_id} style={styles.card}>
        <Text style={styles.cardTitle}>{vehicle.placa}</Text>
        <Text>{labels[vehicle.estado_gps] || vehicle.estado_gps}</Text>
        <Text style={styles.muted}>{vehicle.segundos_sin_actualizar == null ? 'Aún no reporta ubicación' : `Último reporte hace ${vehicle.segundos_sin_actualizar} s`}</Text>
        {vehicle.latitud != null && vehicle.longitud != null ? <Text>
          {Number(vehicle.latitud).toFixed(6)}, {Number(vehicle.longitud).toFixed(6)}
          {vehicle.precision_m != null ? ` · precisión ${Math.round(vehicle.precision_m)} m` : ''}
          {vehicle.velocidad_m_s != null ? ` · ${(vehicle.velocidad_m_s * 3.6).toFixed(1)} km/h` : ''}
        </Text> : null}
      </View>)}
      <Text style={styles.section}>Diagnóstico del proceso</Text>
      <View style={styles.card}>
        <Text>Puntos GPS guardados: {counters.gps_points_saved || 0}</Text>
        <Text>Puntos duplicados: {counters.gps_points_duplicate || 0}</Text>
        <Text>Puntos rechazados: {counters.gps_points_rejected || 0}</Text>
        <Text>Errores de base de datos: {counters.database_errors || 0}</Text>
        <Text>Respuestas HTTP 5xx: {counters.http_responses_5xx || 0}</Text>
      </View>
      <Text style={styles.muted}>Generado: {new Date(summary.generado_en).toLocaleString()}</Text>
    </> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al panel</Text></TouchableOpacity>
  </ScrollView>;
}
