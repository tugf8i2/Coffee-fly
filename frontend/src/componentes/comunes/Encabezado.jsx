import { Image, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import logo from '../../assets/brand/logo.png';
import { SCREEN_LABELS } from '../../configuracion/navegacion';
import { styles } from './Encabezado.styles';

export default function Encabezado({ user, onLogout, screen, go, darkMode = false, onToggleDarkMode }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const currentLabel = SCREEN_LABELS[screen] || SCREEN_LABELS.dashboard;
  const identity = <>
    <Image source={logo} resizeMode="contain" accessibilityLabel="Coffee Fly" style={[styles.logo, !user && styles.loginLogo]} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={[styles.brand, !user && styles.loginBrand]}>COFFEE FLY</Text>
      <Text numberOfLines={2} style={[styles.headerContext, !user && styles.loginHeaderContext]}>{currentLabel}</Text>
    </View>
  </>;
  return <View style={[styles.header, !user && styles.loginHeader]}><View style={[styles.headerInner, compact && styles.compactInner]}>
    {user && screen !== 'dashboard' ? <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Ir a mi panel principal"
      style={[styles.brandGroup, compact && styles.compactBrand]}
      onPress={() => go('dashboard')}
    >
      {identity}
    </TouchableOpacity> : <View style={[styles.brandGroup, compact && styles.compactBrand, !user && styles.loginBrandGroup]}>{identity}</View>}
    {user ? <View style={[styles.headerActions, compact && styles.compactActions]}>
      {!compact && screen !== 'dashboard' ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver al panel principal" style={styles.backButton} onPress={() => go('dashboard')}><Text style={styles.backButtonText}>← Panel</Text></TouchableOpacity> : null}
      <View style={[styles.userBadge, compact && styles.compactUser]}><Text numberOfLines={1} style={styles.userName}>{user.nombre || user.nombre_usuario || 'Usuario'}</Text><Text style={styles.userRole}>{user.rol || ''}</Text></View>
      <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: darkMode }} accessibilityLabel="Cambiar modo oscuro" style={styles.backButton} onPress={onToggleDarkMode}><Text style={styles.backButtonText}>{darkMode ? '☀ Claro' : '☾ Oscuro'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={onLogout}><Text style={styles.headerButton}>Cerrar sesión</Text></TouchableOpacity>
    </View> : null}
  </View></View>;
}
