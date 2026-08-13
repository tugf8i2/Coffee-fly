import { Image, Text, TouchableOpacity, View } from 'react-native';

import logo from '../assets/brand/logo.png';
import { styles } from '../styles/EstilosApp';

export default function Encabezado({ user, onLogout }) {
  return <View style={styles.header}><Image source={logo} style={styles.logo} /><Text style={styles.brand}>COFFEE FLY</Text>{user ? <TouchableOpacity onPress={onLogout}><Text style={styles.headerButton}>Salir</Text></TouchableOpacity> : <View />}</View>;
}
