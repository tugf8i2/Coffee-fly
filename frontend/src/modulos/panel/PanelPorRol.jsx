import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useState } from 'react';
import ResumenCaficultor from './ResumenCaficultor';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import EventMessageInbox from '../../componentes/entregas/BandejaMensajesEventos';
import { gruposPorRol } from '../../configuracion/navegacion';
import usePolling from '../../ganchos/usarSondeo';
import { guardarCacheDashboard, guardarUltimaSincronizacion, obtenerCacheDashboard, obtenerUltimaSincronizacion } from '../../servicios/sinConexion';
import { styles } from './PanelPorRol.styles';
import { readDriverValue, writeDriverValue } from '../conductor/almacenConductor';

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

export default function PanelPorRol({ user, token, go, darkMode = false, onToggleDarkMode }) {
  const [showAll, setShowAll] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [data, setData] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState('');
  const role = String(user?.rol || '').toLowerCase();
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({ compact: false });
  const preferenceKey = `coffee-fly:${role}:prefs:${user?.id || user?.id_usuario}`;
  useEffect(() => {
    readDriverValue(preferenceKey).then((value) => {
      if (!value) return;
      try { const saved = JSON.parse(value); setPreferences((current) => ({ ...current, compact: Boolean(saved.compact) })); } catch { /* Valores predeterminados. */ }
    }).catch(() => {});
  }, [preferenceKey]);
  const savePreferences = () => writeDriverValue(preferenceKey, JSON.stringify(preferences)).catch(() => {});
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
  const primaryScreens = {
    registrador: ['users', 'cooperatives', 'vehicles'],
    coordinador: ['deliveries', 'vehicleAssignment', 'reports'],
    caficultor: ['request', 'farmerDashboard', 'farmLocation'],
    conductor: ['assignedDeliveries', 'tracking'],
  }[role] || [];
  const groups = gruposPorRol(role);
  const visibleGroups = showAll ? groups : [{ title: 'Tareas principales', cards: groups.flatMap((group) => group.cards).filter(([, screen]) => primaryScreens.includes(screen)) }];
  if (Platform.OS === 'web' && role === 'caficultor') return <ResumenCaficultor user={user} data={data} error={error} go={go} onRefresh={load}/>;
  return <ScrollView style={darkMode ? styles.darkPage : null} contentContainerStyle={[styles.page, preferences.compact && styles.compactPage]}>
    <View style={[styles.dashboardIntro, darkMode && styles.darkCard]}>
      <Text style={styles.dashboardEyebrow}>Vista general</Text>
      <Text style={[styles.title, darkMode && styles.darkText]}>Hola, {user?.nombre || user?.nombre_usuario || 'bienvenido'}</Text>
      <Text style={[styles.muted, darkMode && styles.darkMuted]}>Este es tu espacio de trabajo como {role || 'usuario'}. Elige una tarea para continuar.</Text>
      {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : <Text style={[styles.success, styles.dashboardStatus]}>{data ? (data.actualizado_en ? `Actualizado: ${new Date(data.actualizado_en).toLocaleString()}` : 'Resumen disponible') : 'Cargando tu resumen…'}</Text>}
    </View>
    <Text style={[styles.section, darkMode && styles.darkText]}>Resumen operativo</Text>
    <View style={styles.grid}>{Object.entries(metrics).map(([key, value]) => <View key={key} style={[styles.metric, darkMode && styles.darkCard]}><Text style={[styles.metricLabel, darkMode && styles.darkMuted]}>{key.replaceAll('_', ' ')}</Text><Text style={[styles.metricValue, darkMode && styles.darkText]}>{typeof value === 'number' ? value.toLocaleString('es-CO') : value}</Text></View>)}</View>
    {data && !Object.keys(metrics).length ? <Text style={styles.muted}>Todavía no hay movimientos para mostrar. Puedes comenzar con una de las tareas de abajo.</Text> : null}
    {visibleGroups.map(({ title, cards }) => <View key={title} style={{ gap: 14 }}>
    <Text style={[styles.section, darkMode && styles.darkText]}>{title}</Text>
    <View style={styles.grid}>{cards.map(([label, screen]) => {
      const [icon, description] = ACCESS_DETAILS[screen] || ['→', 'Abre este módulo de Coffee Fly.'];
      return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Abrir ${label}`} key={screen} style={[styles.card, styles.actionCard, darkMode && styles.darkCard]} onPress={() => go(screen)}>
        <View style={styles.actionTop}><View style={styles.actionIcon}><Text style={styles.actionIconText}>{icon}</Text></View><Text style={[styles.cardTitle, darkMode && styles.darkText]}>{label}</Text><Text style={[styles.actionDescription, darkMode && styles.darkMuted]}>{description}</Text></View>
        <View style={styles.actionLinkRow}><Text style={[styles.cardLink, darkMode && styles.darkText]}>Abrir módulo</Text><Text style={styles.actionArrow}>→</Text></View>
      </TouchableOpacity>;
    })}</View></View>)}
    {groups.flatMap((group) => group.cards).length > primaryScreens.length ? <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showAll }} style={styles.secondary} onPress={() => setShowAll(!showAll)}><Text style={styles.secondaryText}>{showAll ? 'Mostrar solo tareas principales' : 'Ver todas las herramientas'}</Text></TouchableOpacity> : null}
    {['coordinador', 'caficultor'].includes(role) ? <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showMessages }} style={styles.secondary} onPress={() => setShowMessages(!showMessages)}><Text style={styles.secondaryText}>{showMessages ? 'Ocultar mensajes y novedades' : 'Consultar mensajes y novedades'}</Text></TouchableOpacity>
      {showMessages ? <EventMessageInbox token={token} styles={styles} role={role} /> : null}
    </> : null}
    {role !== 'conductor' ? <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showPreferences }} style={styles.secondary} onPress={() => setShowPreferences((value) => !value)}><Text style={styles.secondaryText}>{showPreferences ? 'Ocultar preferencias' : 'Preferencias'}</Text></TouchableOpacity>
      {showPreferences ? <View style={[styles.preferenceCard, darkMode && styles.darkCard]}><Text style={[styles.cardTitle, darkMode && styles.darkText]}>Preferencias</Text><View style={styles.preferenceRow}><Text style={[styles.cardTitle, darkMode && styles.darkText]}>Modo oscuro</Text><TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: darkMode }} onPress={onToggleDarkMode} style={[styles.preferenceSwitch, darkMode && styles.preferenceSwitchOn]}><View style={[styles.preferenceKnob, darkMode && styles.preferenceKnobOn]} /></TouchableOpacity></View><View style={styles.preferenceRow}><Text style={[styles.cardTitle, darkMode && styles.darkText]}>Vista compacta</Text><TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: preferences.compact }} onPress={() => setPreferences({ ...preferences, compact: !preferences.compact })} style={[styles.preferenceSwitch, preferences.compact && styles.preferenceSwitchOn]}><View style={[styles.preferenceKnob, preferences.compact && styles.preferenceKnobOn]} /></TouchableOpacity></View><TouchableOpacity style={styles.primary} onPress={savePreferences}><Text style={styles.primaryText}>Guardar cambios</Text></TouchableOpacity></View> : null}
    </> : null}
    <TouchableOpacity accessibilityRole="button" style={[styles.secondary, styles.refreshButton]} onPress={load}><Text style={styles.secondaryText}>Actualizar resumen</Text></TouchableOpacity>
  </ScrollView>;
}
