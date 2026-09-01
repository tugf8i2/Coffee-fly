import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../config/Api';

export default function SolicitudesRecoleccion({ go, token, styles }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi(`${API_BASE_URL}/solicitudes/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.detail || 'No se pudieron consultar las solicitudes');
        setRequests(data);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Solicitudes de recolección</Text>
    <Text style={styles.muted}>Solicitudes creadas por los caficultores.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {requests.map((request) => <View style={styles.card} key={request.id_solicitud}>
      <Text style={styles.cardTitle}>Estado: {request.estado_solicitud}</Text>
      <Text>Caficultor: {request.caficultor_id}</Text>
      <Text>Fecha: {new Date(request.fecha_hora_solicitud).toLocaleString()}</Text>
    </View>)}
    {!error && !requests.length ? <Text style={styles.muted}>No hay solicitudes registradas.</Text> : null}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
