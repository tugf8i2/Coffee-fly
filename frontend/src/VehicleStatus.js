import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from './config';
import usePolling from './hooks/usePolling';

const labels = { disponible: 'Disponible', 'en camino': 'En camino', 'en mantenimiento': 'En mantenimiento' };

export default function VehicleStatus({ go, token, styles }) {
  const [vehicles, setVehicles] = useState([]);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/vehiculos/estado`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo consultar el estado de los vehículos.');
      setVehicles(data); setMessage('');
    } catch (error) { setMessage(error.message); }
  }, [token]);
  usePolling(load, 15000);
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Estado de vehículos</Text>
    <Text style={styles.muted}>Panel actualizado automáticamente cada 15 segundos.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    {vehicles.map((vehicle) => <View key={vehicle.id_vehiculo} style={styles.card}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      <Text>Capacidad: {vehicle.capacidad_kg} kg</Text>
      <Text style={styles.muted}>Estado: {labels[vehicle.estado_vehiculo] || vehicle.estado_vehiculo}</Text>
    </View>)}
    {!vehicles.length ? <Text style={styles.muted}>No hay vehículos registrados.</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar panel</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
