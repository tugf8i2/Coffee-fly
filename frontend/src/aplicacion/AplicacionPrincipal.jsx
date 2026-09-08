import FeedbackMessage from '../componentes/comunes/MensajeRetroalimentacion';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import AssignedDeliveries from '../modulos/entregas/EntregasAsignadas';
import AssignmentHistory from '../modulos/entregas/HistorialAsignaciones';
import CooperativeManagement from '../modulos/cooperativas/GestionCooperativas';
import DeliveryHistory from '../modulos/entregas/HistorialEntregas';
import DeliveryManagement from '../modulos/entregas/RegistrarRecoleccionCafe';
import AppErrorBoundary from '../componentes/comunes/LimiteErrorAplicacion';
import Encabezado from '../componentes/comunes/Encabezado';
import IniciarSesion from '../modulos/autenticacion/IniciarSesion';
import MiActividad from '../modulos/caficultor/MiActividad';
import OperationalMonitoring from '../modulos/seguimiento/MonitoreoOperativo';
import Reports from '../modulos/reportes/Reportes';
import RoleDashboard from '../modulos/panel/PanelPorRol';
import SeguimientoVehiculo from '../modulos/seguimiento/SeguimientoVehiculo';
import SolicitarRecoleccion from '../modulos/caficultor/SolicitarRecoleccion';
import UbicacionFinca from '../modulos/caficultor/UbicacionFinca';
import UserManagement from '../modulos/usuarios/GestionUsuarios';
import VehicleAssignment from '../modulos/vehiculos/AsignacionVehiculos';
import VehicleManagement from '../modulos/vehiculos/GestionVehiculos';
import VehicleStatus from '../modulos/vehiculos/EstadoVehiculos';
import { API_BASE_URL, fetchApi, subscribeSessionExpired } from '../configuracion';
import { detenerRastreoSegundoPlano } from '../servicios/ubicacionSegundoPlano';
import { connectionLabel, synchronizationLabel } from '../servicios/presentacionConexion';
import { observarConexion, sincronizarPendientes } from '../servicios/sinConexion';
import {
  clearAuthenticatedSession,
  getAuthenticatedSession,
  saveAuthenticatedSession,
} from '../servicios/sesionSeguimiento';
import { styles } from '../estilos';

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

export default function AplicacionPrincipal() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [syncMessage, setSyncMessageText] = useState('');
  const [syncMessageType, setSyncMessageType] = useState('info');
  const setSyncMessage = (text, type = 'info') => { setSyncMessageText(text); setSyncMessageType(type); };
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
      ].filter(Boolean).join(' · '), result.conflictos || result.descartadas ? 'warning' : 'success');
    }
  };
  const synchronizeSession = async (token) => {
    setSyncStatus('syncing');
    try {
      showSyncResult(await sincronizarPendientes(token));
    } catch (error) {
      setSyncStatus('pending');
      setSyncMessage(`No fue posible sincronizar todavía: ${error.message}`, 'warning');
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
    setSyncMessage('Tu sesión venció. Inicia sesión nuevamente; los datos offline permanecen guardados.', 'warning');
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
    deliveries: <DeliveryManagement {...common} />,
    vehicleAssignment: <VehicleAssignment {...common} />,
    assignmentHistory: <AssignmentHistory {...common} />,
    assignedDeliveries: <AssignedDeliveries {...common} />,
    deliveryHistory: <DeliveryHistory {...common} />,
    reports: <Reports {...common} />,
    monitoring: <OperationalMonitoring {...common} />,
  };
  if (restoring) return <SafeAreaProvider>
    <SafeAreaView style={styles.safe}><Text style={styles.muted}>Restaurando sesión segura…</Text></SafeAreaView>
  </SafeAreaProvider>;
  return <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <Encabezado user={user} onLogout={logout} />
      {user ? <View style={styles.connectionBanner}>
        <Text style={styles.connectionText}>Red: {displayedConnection} · Datos: {displayedSynchronization}</Text>
      </View> : null}
      {syncMessage ? <FeedbackMessage type={syncMessageType}>{syncMessage}</FeedbackMessage> : null}
      <AppErrorBoundary key={screen} styles={styles} onReset={() => setScreen('dashboard')}>
        {screens[screen] || screens.dashboard}
      </AppErrorBoundary>
      <StatusBar style="light" />
    </SafeAreaView>
  </SafeAreaProvider>;
}
