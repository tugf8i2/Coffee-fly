import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BannerCafe from '../../componentes/comunes/BannerCafe';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';

const menu = [['⌂', 'Inicio', 'dashboard'], ['♧', 'Cooperativas', 'cooperatives'], ['▰', 'Vehículos', 'vehicles'], ['♙', 'Usuarios', 'users']];
const actions = [['♧', 'Registrar Cooperativa', 'Crea una nueva cooperativa', 'cooperatives'], ['♙', 'Crear usuario', 'Caficultor, conductor y otros roles', 'users'], ['▰', 'Registrar Vehículo', 'Registra un vehículo de transporte', 'vehicles']];
const metrics = [['♧', 'cooperativas', 'Cooperativas registradas'], ['♙', 'caficultores', 'Caficultores registrados'], ['▰', 'vehiculos', 'Vehículos registrados'], ['➤', 'conductores', 'Conductores registrados']];

export default function RegistradorLayout({ token, user, screen, go, onLogout, connectionStatus, notice, children }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const name = [user?.nombre || user?.nombre_usuario || 'Registrador', user?.apellido].filter(Boolean).join(' ');
  const load = useCallback(async () => {
    const get = async (path) => {
      const response = await fetchApi(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw Error('No fue posible actualizar los registros del panel.');
      return response.json();
    };
    try {
      const [users, vehicles, cooperatives] = await Promise.all([get('/usuarios/'), get('/vehiculos/'), get('/cooperativas/?skip=0&limit=100')]);
      const totals = { cooperativas: cooperatives.length, vehiculos: vehicles.length, conductores: 0, caficultores: 0 };
      for (const item of users) {
        if (Number(item.rol_id) === 2) totals.conductores++;
        if (Number(item.rol_id) === 4) totals.caficultores++;
      }
      setSummary({ totals, cooperatives: [...cooperatives].sort((a, b) => b.id_cooperativa - a.id_cooperativa) });
      setError('');
    } catch (reason) { setError(reason.message); }
  }, [token]);
  usePolling(load, 30000);
  const navigate = (target) => { setMenuOpen(false); setProfileOpen(false); go(target); };
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.topbar}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir menú" onPress={() => { setMenuOpen(!menuOpen); setProfileOpen(false); }} style={s.topButton}><Text style={s.topIcon}>☰</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Coffee Fly, inicio" onPress={() => navigate('dashboard')} style={s.brand}><Text style={s.brandIcon}>◉</Text><Text style={s.brandText}>Coffee Fly</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cuenta de registrador" onPress={() => { setProfileOpen(!profileOpen); setMenuOpen(false); }} style={s.avatar}><Text style={s.avatarText}>{name[0]?.toUpperCase()}</Text></TouchableOpacity>
    </View>
    {menuOpen && <View style={s.menu}>
      <View style={s.menuUser}><Text style={s.menuName}>{name}</Text><Text style={s.menuRole}>Registrador · {connectionStatus === 'online' ? 'En línea' : 'Sin conexión'}</Text></View>
      {menu.map(([icon, label, target]) => <TouchableOpacity key={target} accessibilityRole="button" accessibilityState={{ selected: screen === target }} onPress={() => navigate(target)} style={[s.menuItem, screen === target && s.menuActive]}><Text style={s.menuIcon}>{icon}</Text><Text style={s.menuLabel}>{label}</Text></TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" onPress={onLogout} style={s.menuItem}><Text style={s.menuIcon}>↪</Text><Text style={s.menuLabel}>Cerrar sesión</Text></TouchableOpacity>
    </View>}
    {profileOpen && <View style={s.profile}>
      <Text style={s.profileName}>{name}</Text><Text style={s.secondary}>{user?.correo_usuario || 'Cuenta de registrador'}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => navigate('users')} style={s.profileLink}><Text style={s.linkText}>Gestionar cuentas</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onLogout} style={s.profileLink}><Text style={s.linkText}>Cerrar sesión</Text></TouchableOpacity>
    </View>}
    {screen === 'dashboard' ? <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {notice ? <Text style={s.notice}>{notice}</Text> : null}
      {error ? <TouchableOpacity accessibilityRole="button" onPress={load} style={s.notice}><Text style={s.error}>{error} Toca para reintentar.</Text></TouchableOpacity> : null}
      <BannerCafe title="Construyendo la cadena del café" subtitle="Registra, organiza y conecta a todos los actores del transporte cafetero." />
      <View style={s.metrics}>{metrics.map(([icon, key, label]) => <View key={key} style={s.metric}><View style={s.metricIcon}><Text style={s.metricIconText}>{icon}</Text></View><Text style={s.metricValue}>{summary?.totals[key] ?? '—'}</Text><Text style={s.metricLabel}>{label}</Text></View>)}</View>
      <View style={s.card}><Text style={s.cardTitle}>Acciones rápidas</Text>{actions.map(([icon, title, detail, target]) => <TouchableOpacity key={target} accessibilityRole="button" onPress={() => navigate(target)} style={s.action}><Text style={s.actionIconText}>{icon}</Text><View style={s.actionCopy}><Text style={s.actionTitle}>{title}</Text><Text style={s.secondary}>{detail}</Text></View><Text style={s.actionArrow}>›</Text></TouchableOpacity>)}</View>
      <View style={s.card}><View style={s.cardHeading}><Text style={s.cardTitle}>Cooperativas recientes</Text><TouchableOpacity accessibilityRole="button" onPress={() => navigate('cooperatives')}><Text style={s.linkText}>Ver todas</Text></TouchableOpacity></View>{summary?.cooperatives?.length ? summary.cooperatives.slice(0, 5).map((coop) => <View key={coop.id_cooperativa} style={s.listItem}><Text style={s.listTitle}>{coop.nombre}</Text><Text style={s.secondary}>{coop.nit || 'Sin NIT'} · {coop.estado || 'Registrada'}</Text></View>) : <Text style={s.empty}>Aún no hay cooperativas registradas.</Text>}</View>
      <Text style={s.footer}>Coffee Fly · Tu café viaja</Text>
    </ScrollView> : <View style={s.module}>{notice ? <Text style={s.notice}>{notice}</Text> : null}{children}</View>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafbf9' }, topbar: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e7e9' }, topButton: { width: 44, height: 44, justifyContent: 'center' }, topIcon: { fontSize: 25, color: '#064c3b' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 7 }, brandIcon: { fontSize: 23, color: '#064c3b' }, brandText: { fontSize: 22, fontWeight: '800', color: '#064c3b' }, avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#e0f1e6', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 18, fontWeight: '700', color: '#064c3b' },
  scroll: { flex: 1 }, content: { padding: 14, gap: 16, paddingBottom: 32 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', flexGrow: 1, minHeight: 125, padding: 13, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e7e9' }, metricIcon: { width: 37, height: 37, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0f1e6' }, metricIconText: { fontSize: 22, color: '#064c3b' }, metricValue: { fontSize: 26, fontWeight: '800', color: '#0b2639', marginTop: 5 }, metricLabel: { fontSize: 12, color: '#45546e' }, card: { borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e7e9', padding: 15, gap: 10 }, cardTitle: { fontSize: 18, fontWeight: '700', color: '#0b2639' }, cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, action: { minHeight: 82, padding: 12, borderRadius: 10, backgroundColor: '#e8f3e9', flexDirection: 'row', alignItems: 'center', gap: 13 }, actionIconText: { fontSize: 26, color: '#064c3b', width: 35 }, actionCopy: { flex: 1 }, actionTitle: { fontSize: 16, fontWeight: '700', color: '#064c3b' }, actionArrow: { fontSize: 28, color: '#064c3b' }, secondary: { fontSize: 12, color: '#58647a', lineHeight: 17 }, listItem: { borderTopWidth: 1, borderTopColor: '#edf0ef', paddingVertical: 10 }, listTitle: { fontSize: 15, color: '#213647', fontWeight: '600' }, empty: { paddingVertical: 24, textAlign: 'center', color: '#6d7781' }, footer: { textAlign: 'center', color: '#5c687b', paddingTop: 8 },
  menu: { position: 'absolute', top: 64, left: 0, width: '78%', maxWidth: 320, zIndex: 20, backgroundColor: '#123c2e', paddingBottom: 20, elevation: 12, borderBottomRightRadius: 12 }, menuUser: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#ffffff22' }, menuName: { color: '#fff', fontWeight: '700', fontSize: 17 }, menuRole: { color: '#a7d9b5', fontSize: 12, marginTop: 4 }, menuItem: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 22 }, menuActive: { backgroundColor: '#205d4b' }, menuIcon: { color: '#fff', fontSize: 23, width: 25 }, menuLabel: { color: '#fff', fontSize: 16 }, profile: { position: 'absolute', zIndex: 20, top: 64, right: 8, width: 260, backgroundColor: '#fff', borderRadius: 10, padding: 17, elevation: 12, borderWidth: 1, borderColor: '#e0e7e9' }, profileName: { fontSize: 16, fontWeight: '700', color: '#0b2639' }, profileLink: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#edf0ef', marginTop: 8 }, linkText: { color: '#005139', fontSize: 14, fontWeight: '600' }, module: { flex: 1 }, notice: { margin: 12, padding: 12, borderRadius: 8, color: '#80440d', backgroundColor: '#fff0d9' }, error: { color: '#80440d' },
});
