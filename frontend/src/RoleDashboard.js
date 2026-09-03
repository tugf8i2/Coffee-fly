import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from './config';
import EventMessageInbox from './components/EventMessageInbox';
import { ROLE_CARDS } from './navigationConfig';
import usePolling from './hooks/usePolling';
import { guardarCacheDashboard, guardarUltimaSincronizacion, obtenerCacheDashboard, obtenerUltimaSincronizacion } from './services/offline';

export default function RoleDashboard({ user, token, go, styles }) {
  const [data, setData] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState('');
  const role = String(user?.rol || '').toLowerCase();
  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/dashboard/`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw Error(result.detail || 'No se pudo actualizar el panel.');
      setData(result); setError('');
      try { await guardarCacheDashboard(result); setLastSync(await guardarUltimaSincronizacion()); } catch {}
    } catch (reason) {
      const connectionFailure = /conectar|conexión|tardó demasiado/i.test(reason.message);
      if (!connectionFailure) { setError(reason.message); return; }
      const cached = await obtenerCacheDashboard();
      if (cached) setData(cached);
      const savedAt = await obtenerUltimaSincronizacion();
      setLastSync(savedAt);
      setError(`Sin conexión. Mostrando el último estado sincronizado${savedAt ? ` (${new Date(savedAt).toLocaleString()})` : ''}.`);
    }
  }, [token]);
  usePolling(load, 30000);
  const metrics = data?.metricas || {};
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Panel del {role || 'usuario'}</Text>
    <Text style={styles.muted}>Hola, {user?.nombre}. Resumen actualizado de tus operaciones.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.success}>Actualizado: {data?.actualizado_en ? new Date(data.actualizado_en).toLocaleString() : 'ahora'}</Text>}
    {['coordinador', 'caficultor'].includes(role) ? <EventMessageInbox token={token} styles={styles} /> : null}
    {Object.entries(metrics).map(([key, value]) => <View key={key} style={styles.metric}><Text style={styles.metricLabel}>{key.replaceAll('_', ' ')}</Text><Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString('es-CO') : value}</Text></View>)}
    <Text style={styles.section}>Accesos directos</Text>
    {(ROLE_CARDS[role] || []).map(([label, screen]) => <TouchableOpacity key={screen} style={styles.card} onPress={() => go(screen)}><Text style={styles.cardTitle}>{label}</Text><Text style={styles.cardLink}>Abrir módulo</Text></TouchableOpacity>)}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar panel</Text></TouchableOpacity>
  </ScrollView>;
}
