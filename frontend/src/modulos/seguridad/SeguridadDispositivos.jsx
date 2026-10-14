import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';

const green = '#08684e';
const card = { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#d5dfd8', gap: 8 };
const button = { backgroundColor: green, borderRadius: 12, padding: 14, alignItems: 'center' };

export default function SeguridadDispositivos({ token, user }) {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [busy, setBusy] = useState(false);
  const role = String(user?.rol || '').toLowerCase();
  const load = useCallback(async (proof = password) => {
    const response = await fetchApi(`${API_BASE_URL}/security/sessions/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: proof }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'No fue posible consultar los dispositivos.');
    setSessions(data);
    setUnlocked(true);
    setError('');
  }, [password, token]);
  useEffect(() => {
    if (!unlocked) return undefined;
    const timer = setInterval(() => load().catch((reason) => setError(reason.message)), 30000);
    return () => clearInterval(timer);
  }, [unlocked, load]);
  const unlock = async () => {
    setBusy(true);
    try { await load(); } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  const revoke = async (id) => {
    setBusy(true);
    try {
      const response = await fetchApi(`${API_BASE_URL}/security/sessions/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'No fue posible revocar la sesión.');
      setPendingRevoke(null);
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  if (role !== 'registrador') return <Text>Este módulo requiere el perfil Registrador.</Text>;
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16, backgroundColor: '#f5f8f4', flexGrow: 1 }}>
    <Text style={{ fontSize: 27, fontWeight: '800', color: '#083e31' }}>Seguridad de dispositivos</Text>
    <Text style={{ color: '#425d55', fontSize: 15 }}>Consulta las sesiones del APK y revoca el acceso de un equipo perdido. La sesión se cerrará cuando el equipo vuelva a conectarse.</Text>
    {!unlocked ? <View style={card}>
      <Text style={{ fontWeight: '700', color: '#143b31' }}>Confirma tu contraseña de Registrador</Text>
      <TextInput accessibilityLabel="Contraseña de administración" secureTextEntry value={password} onChangeText={setPassword} placeholder="Contraseña" style={{ borderWidth: 1, borderColor: '#a9bdb1', borderRadius: 10, padding: 12, backgroundColor: '#fff' }} />
      <TouchableOpacity accessibilityRole="button" disabled={busy || !password} onPress={unlock} style={button}><Text style={{ color: '#fff', fontWeight: '700' }}>Abrir dispositivos</Text></TouchableOpacity>
    </View> : <>
      <TouchableOpacity accessibilityRole="button" onPress={() => load().catch((reason) => setError(reason.message))} style={button}><Text style={{ color: '#fff', fontWeight: '700' }}>Actualizar ahora</Text></TouchableOpacity>
      <Text style={{ color: '#425d55' }}>{sessions.filter((session) => session.active).length} sesiones activas · actualización automática cada 30 segundos</Text>
      {sessions.map((session) => <View key={session.id} style={card}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#143b31' }}>{session.device_name}</Text>
        <Text style={{ color: '#425d55' }}>{session.user_name} · {session.role || 'sin perfil'} · {session.platform || 'plataforma desconocida'}</Text>
        <Text style={{ color: '#425d55' }}>Inicio: {session.started_at ? new Date(session.started_at).toLocaleString('es-CO') : 'desconocido'}</Text>
        <Text style={{ color: '#425d55' }}>Última conexión: {session.last_seen_at ? new Date(session.last_seen_at).toLocaleString('es-CO') : 'sin datos'}</Text>
        <Text style={{ fontWeight: '700', color: session.active ? green : '#8b2e2e' }}>{session.active ? 'Activa' : 'Cerrada'}</Text>
        {session.active && pendingRevoke !== session.id ? <TouchableOpacity accessibilityRole="button" onPress={() => setPendingRevoke(session.id)} style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#9e2d2d' }}><Text style={{ color: '#9e2d2d', fontWeight: '700' }}>Revocar acceso</Text></TouchableOpacity> : null}
        {pendingRevoke === session.id ? <View style={{ gap: 8 }}><Text style={{ color: '#9e2d2d' }}>El equipo perderá acceso en su próxima conexión. ¿Confirmas?</Text><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => revoke(session.id)} style={{ ...button, backgroundColor: '#9e2d2d' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Confirmar revocación</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setPendingRevoke(null)}><Text style={{ color: green }}>Cancelar</Text></TouchableOpacity></View> : null}
      </View>)}
    </>}
    {error ? <Text accessibilityRole="alert" style={{ color: '#9e2d2d', fontWeight: '700' }}>{error}</Text> : null}
  </ScrollView>;
}
