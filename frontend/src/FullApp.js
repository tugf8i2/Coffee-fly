import { useEffect, useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import AssignedDeliveries from './AssignedDeliveries';
import AssignmentHistory from './AssignmentHistory';
import CooperativeManagement from './CooperativeManagement';
import DeliveryHistory from './DeliveryHistory';
import DeliveryManagement from './DeliveryManagement';
import AppErrorBoundary from './components/AppErrorBoundary';
import Encabezado from './components/Encabezado';
import IniciarSesion from './pages/IniciarSesion';
import MiActividad from './pages/MiActividad';
import OperationalMonitoring from './OperationalMonitoring';
import Reports from './Reports';
import RoleDashboard from './RoleDashboard';
import SeguimientoVehiculo from './pages/SeguimientoVehiculo';
import SolicitarRecoleccion from './pages/SolicitarRecoleccion';
import SolicitudesRecoleccion from './pages/SolicitudesRecoleccion';
import UbicacionFinca from './pages/UbicacionFinca';
import UserManagement from './UserManagement';
import VehicleAssignment from './VehicleAssignment';
import VehicleManagement from './VehicleManagement';
import VehicleStatus from './VehicleStatus';
import { API_BASE_URL, fetchApi, subscribeSessionExpired } from './config';
import { detenerRastreoSegundoPlano } from './services/backgroundLocation';
import { connectionLabel, synchronizationLabel } from './services/connectionPresentation';
import { observarConexion, sincronizarPendientes } from './services/offline';
import {
  clearAuthenticatedSession,
  getAuthenticatedSession,
  saveAuthenticatedSession,
} from './services/trackingSession';
import { styles } from './styles/EstilosApp';

let sessionToken = '';

async function closeRemoteSession(token) {
  if (!token) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetchApi(`${API_BASE_URL}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch {
    // La limpieza local no debe quedar bloqueada si el servidor está offline.
  } finally {
    clearTimeout(timer);
  }
}

async function validateSavedSession(saved) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchApi(`${API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${saved.token}` },
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) return saved;
    return { ...saved, user: await response.json() };
  } catch {
    // Offline First: una falla de red no invalida una sesión local todavía vigente.
    return saved;
  } finally {
    clearTimeout(timer);
  }
}

export default function FullApp() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [restoring, setRestoring] = useState(true);
  const showSyncResult = (result) => {
    setSyncStatus(result?.estado || 'synced');
    if (result?.sincronizadas || result?.duplicados || result?.conflictos || result?.descartadas) {
      setSyncMessage([
        `${result.sincronizadas || 0} registro(s) sincronizado(s)`,
        result.duplicados ? `${result.duplicados} duplicado(s) confirmado(s)` : '',
        result.conflictos ? `${result.conflictos} conflicto(s)` : '',
        result.descartadas ? `${result.descartadas} punto(s) inválido(s) conservado(s) para diagnóstico` : '',
      ].filter(Boolean).join(' · '));
    }
  };
  const synchronizeSession = async (token) => {
    setSyncStatus('syncing');
    try {
      showSyncResult(await sincronizarPendientes(token));
    } catch (error) {
      setSyncStatus('pending');
      setSyncMessage(`No fue posible sincronizar todavía: ${error.message}`);
    }
  };
  const login = async (nextUser, token) => {
    sessionToken = token;
    await saveAuthenticatedSession(nextUser, token);
    setUser(nextUser);
    setScreen('dashboard');
    await synchronizeSession(token);
  };
  const logout = async () => {
    const token = sessionToken;
    await detenerRastreoSegundoPlano();
    await closeRemoteSession(token);
    await clearAuthenticatedSession();
    sessionToken = '';
    setUser(null);
    setScreen('login');
    setSyncMessage('');
    setConnectionStatus('checking');
    setSyncStatus('idle');
  };
  useEffect(() => {
    let mounted = true;
    getAuthenticatedSession().then(async (stored) => {
      const saved = stored?.token && stored?.user ? await validateSavedSession(stored) : null;
      if (stored && !saved) await clearAuthenticatedSession();
      if (!mounted || !saved?.token || !saved?.user) return;
      sessionToken = saved.token;
      setUser(saved.user);
      setScreen('dashboard');
      await synchronizeSession(saved.token);
    }).finally(() => mounted && setRestoring(false));
    return () => { mounted = false; };
  }, []);
  useEffect(() => observarConexion(
    sessionToken,
    (result) => {
      showSyncResult(result);
      if (result.sincronizadas || result.conflictos) {
        setSyncMessage(`${result.sincronizadas} registro(s) sincronizado(s)${result.conflictos ? `; ${result.conflictos} conflicto(s) resuelto(s) con la versión del servidor.` : ''}`);
      }
    },
    (status) => {
      setConnectionStatus(status);
      if (status === 'online' && sessionToken) setSyncStatus('syncing');
    },
  ), [user]);
  useEffect(() => subscribeSessionExpired(async () => {
    if (!sessionToken) return;
    await detenerRastreoSegundoPlano();
    await clearAuthenticatedSession();
    sessionToken = '';
    setUser(null);
    setScreen('login');
    setSyncMessage('Tu sesión venció. Inicia sesión nuevamente; los datos offline permanecen guardados.');
  }), []);
  const common = { go: setScreen, token: sessionToken, styles, user };
  const displayedConnection = connectionLabel(connectionStatus);
  const displayedSynchronization = synchronizationLabel(connectionStatus, syncStatus);
  const screens = {
    login: <IniciarSesion onLogin={login} styles={styles} />,
    dashboard: <RoleDashboard {...common} />,
    request: <SolicitarRecoleccion {...common} />,
    farmLocation: <UbicacionFinca {...common} />,
    farmerDashboard: <MiActividad {...common} />,
    tracking: <SeguimientoVehiculo {...common} />,
    users: <UserManagement {...common} />,
    cooperatives: <CooperativeManagement {...common} />,
    vehicles: <VehicleManagement {...common} />,
    vehicleStatus: <VehicleStatus {...common} />,
    requests: <SolicitudesRecoleccion {...common} />,
    deliveries: <DeliveryManagement {...common} />,
    vehicleAssignment: <VehicleAssignment {...common} />,
    assignmentHistory: <AssignmentHistory {...common} />,
    assignedDeliveries: <AssignedDeliveries {...common} />,
    deliveryHistory: <DeliveryHistory {...common} />,
    reports: <Reports {...common} />,
    monitoring: <OperationalMonitoring {...common} />,
  };
  if (restoring) return <SafeAreaView style={styles.safe}><Text style={styles.muted}>Restaurando sesión segura…</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safe}>
    <Encabezado user={user} onLogout={logout} />
    {user ? <View style={styles.connectionBanner}>
      <Text style={styles.connectionText}>Red: {displayedConnection} · Datos: {displayedSynchronization}</Text>
    </View> : null}
    {syncMessage ? <Text style={styles.success}>{syncMessage}</Text> : null}
    <AppErrorBoundary key={screen} styles={styles} onReset={() => setScreen('dashboard')}>
      {screens[screen] || screens.dashboard}
    </AppErrorBoundary>
    <StatusBar style="light" />
  </SafeAreaView>;
}
