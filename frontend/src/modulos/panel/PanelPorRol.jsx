import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import EventMessageInbox from '../../componentes/entregas/BandejaMensajesEventos';
import { ROLE_CARDS } from '../../configuracion/navegacion';
import usePolling from '../../ganchos/usarSondeo';
import { guardarCacheDashboard, guardarUltimaSincronizacion, obtenerCacheDashboard, obtenerUltimaSincronizacion } from '../../servicios/sinConexion';
import { styles } from './PanelPorRol.styles';

const ACCESS_DETAILS = {
  farmLocation: ['⌖', 'Define el punto donde el vehículo recogerá tu café.'],
  request: ['＋', 'Registra una nueva carga y solicita su recolección.'],
  farmerDashboard: ['◷', 'Consulta el estado actual de tus solicitudes.'],
  deliveryHistory: ['≡', 'Revisa entregas anteriores y filtra resultados.'],
  tracking: ['⌁', 'Consulta la ubicación y el avance del vehículo.'],
  users: ['♙', 'Administra cuentas, roles y datos de usuarios.'],
  cooperatives: ['◇', 'Gestiona cooperativas y sus ubicaciones.'],
  vehicles: ['▰', 'Registra vehículos y actualiza sus datos.'],
  deliveries: ['✓', 'Confirma las solicitudes recibidas de caficultores.'],
  vehicleAssignment: ['↗', 'Asigna conductor, vehículo y destino a una carga.'],
  vehicleStatus: ['●', 'Consulta disponibilidad y capacidad de la flota.'],
  monitoring: ['◎', 'Supervisa viajes activos y calidad de las ubicaciones.'],
  assignmentHistory: ['↻', 'Consulta los cambios de asignación realizados.'],
  reports: ['▥', 'Genera informes operativos por rango de fechas.'],
  assignedDeliveries: ['▣', 'Revisa los viajes de recolección pendientes de iniciar.'],
  support: ['✉', 'Conversa sobre una carga con la persona responsable.'],
};

export default function PanelPorRol({ user, token, go }) {
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
    <View style={styles.dashboardIntro}>
      <Text style={styles.dashboardEyebrow}>Vista general</Text>
      <Text style={styles.title}>Panel del {role || 'usuario'}</Text>
      <Text style={styles.muted}>Hola, {user?.nombre}. Aquí encuentras el estado de tu operación y tus tareas principales.</Text>
      {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : <Text style={[styles.success, styles.dashboardStatus]}>Actualizado: {data?.actualizado_en ? new Date(data.actualizado_en).toLocaleString() : 'ahora'}</Text>}
    </View>
    <Text style={styles.section}>Resumen operativo</Text>
    <View style={styles.grid}>{Object.entries(metrics).map(([key, value]) => <View key={key} style={styles.metric}><Text style={styles.metricLabel}>{key.replaceAll('_', ' ')}</Text><Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString('es-CO') : value}</Text></View>)}</View>
    {['coordinador', 'caficultor'].includes(role) ? <EventMessageInbox token={token} styles={styles} role={role} /> : null}
    <Text style={styles.section}>Accesos directos</Text>
    <View style={styles.grid}>{(ROLE_CARDS[role] || []).map(([label, screen]) => {
      const [icon, description] = ACCESS_DETAILS[screen] || ['→', 'Abre este módulo de Coffee Fly.'];
      return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Abrir ${label}`} key={screen} style={[styles.card, styles.actionCard]} onPress={() => go(screen)}>
        <View style={styles.actionTop}><View style={styles.actionIcon}><Text style={styles.actionIconText}>{icon}</Text></View><Text style={styles.cardTitle}>{label}</Text><Text style={styles.actionDescription}>{description}</Text></View>
        <View style={styles.actionLinkRow}><Text style={styles.cardLink}>Abrir módulo</Text><Text style={styles.actionArrow}>→</Text></View>
      </TouchableOpacity>;
    })}</View>
    <TouchableOpacity style={[styles.primary, styles.refreshButton]} onPress={load}><Text style={styles.primaryText}>Actualizar panel</Text></TouchableOpacity>
  </ScrollView>;
}
