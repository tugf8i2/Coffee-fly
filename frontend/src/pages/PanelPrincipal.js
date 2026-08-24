import { ScrollView, Text, TouchableOpacity } from 'react-native';

export default function PanelPrincipal({ user, go, styles }) {
  const role = String(user?.rol || '').toLowerCase();
  const cards = role === 'caficultor' ? [['Solicitar recolección', 'request'], ['Mi actividad', 'farmerDashboard'], ['Seguimiento de vehículo', 'tracking']] : role === 'registrador' ? [['Usuarios', 'users']] : role === 'coordinador' ? [['Solicitudes', 'requests']] : [];
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>Panel del {role}</Text><Text style={styles.muted}>Hola, {user?.nombre}.</Text>{cards.map(([name, action]) => <TouchableOpacity key={action} style={styles.card} onPress={() => go(action)}><Text style={styles.cardTitle}>{name}</Text><Text style={styles.cardLink}>Abrir módulo</Text></TouchableOpacity>)}</ScrollView>;
}
