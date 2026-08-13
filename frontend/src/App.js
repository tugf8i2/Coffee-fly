import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView } from 'react-native';

import Encabezado from './components/Encabezado';
import GestionUsuarios from './pages/GestionUsuarios';
import IniciarSesion from './pages/IniciarSesion';
import MiActividad from './pages/MiActividad';
import PanelPrincipal from './pages/PanelPrincipal';
import SeguimientoVehiculo from './pages/SeguimientoVehiculo';
import SolicitarRecoleccion from './pages/SolicitarRecoleccion';
import SolicitudesRecoleccion from './pages/SolicitudesRecoleccion';
import { styles } from './styles/EstilosApp';

let sessionToken = '';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const login = (nextUser, token) => { sessionToken = token; setUser(nextUser); setScreen('dashboard'); };
  const logout = () => { sessionToken = ''; setUser(null); setScreen('login'); };
  const commonProps = { go: setScreen, token: sessionToken, styles };

  const screens = {
    login: <IniciarSesion onLogin={login} styles={styles} />,
    tracking: <SeguimientoVehiculo {...commonProps} />,
    farmerDashboard: <MiActividad {...commonProps} />,
    request: <SolicitarRecoleccion {...commonProps} />,
    users: <GestionUsuarios {...commonProps} />,
    requests: <SolicitudesRecoleccion {...commonProps} />,
    dashboard: <PanelPrincipal user={user} go={setScreen} styles={styles} />,
  };

  return <SafeAreaView style={styles.safe}><Encabezado user={user} onLogout={logout} />{screens[screen] || screens.dashboard}<StatusBar style="light" /></SafeAreaView>;
}
