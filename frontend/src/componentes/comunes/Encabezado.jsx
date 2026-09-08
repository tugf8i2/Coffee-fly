import { Image, Text, TouchableOpacity, View } from 'react-native';

import logo from '../../assets/brand/logo.png';
import { SCREEN_LABELS } from '../../configuracion/navegacion';
import { styles } from './Encabezado.styles';

export default function Encabezado({ user, onLogout, screen, go }) {
  const currentLabel = SCREEN_LABELS[screen] || SCREEN_LABELS.dashboard;
  const identity = <>
    <Image source={logo} style={[styles.logo, !user && styles.loginLogo]} />
    <View>
      <Text style={[styles.brand, !user && styles.loginBrand]}>COFFEE FLY</Text>
      <Text style={[styles.headerContext, !user && styles.loginHeaderContext]}>{currentLabel}</Text>
    </View>
  </>;
  return <View style={[styles.header, !user && styles.loginHeader]}><View style={styles.headerInner}>
    {user && screen !== 'dashboard' ? <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Ir a mi panel principal"
      style={styles.brandGroup}
      onPress={() => go('dashboard')}
    >
      {identity}
    </TouchableOpacity> : <View style={[styles.brandGroup, !user && styles.loginBrandGroup]}>{identity}</View>}
    {user ? <View style={styles.headerActions}>
      {screen !== 'dashboard' ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver al panel principal" style={styles.backButton} onPress={() => go('dashboard')}><Text style={styles.backButtonText}>← Panel</Text></TouchableOpacity> : null}
      <View style={styles.userBadge}><Text style={styles.userName}>{user.nombre || user.nombre_usuario || 'Usuario'}</Text><Text style={styles.userRole}>{user.rol || ''}</Text></View>
      <TouchableOpacity accessibilityRole="button" onPress={onLogout}><Text style={styles.headerButton}>Salir</Text></TouchableOpacity>
    </View> : null}
  </View></View>;
}
