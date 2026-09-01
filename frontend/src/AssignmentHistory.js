import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from './config';

const formatDate = (value) => new Date(value).toLocaleString();

export default function AssignmentHistory({ go, token, styles }) {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetchApi(`${API_BASE_URL}/entregas/historial-asignaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo consultar el historial de asignaciones.');
      setAssignments(data);
    } catch (reason) {
      setError(reason.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Historial de asignaciones</Text>
    <Text style={styles.muted}>Consulta cada entrega asignada con su vehículo, conductor y coordinador responsable.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {assignments.map((assignment) => <View key={assignment.id_asignacion} style={styles.card}>
      <Text style={styles.cardTitle}>{assignment.caficultor_nombre} · {assignment.cantidad_kg} kg</Text>
      <Text>Vehículo: {assignment.vehiculo_placa}</Text>
      <Text>Conductor: {assignment.conductor_nombre}</Text>
      <Text>Asignado por: {assignment.coordinador_nombre}</Text>
      <Text style={styles.muted}>Fecha: {formatDate(assignment.fecha_hora_asignacion)}</Text>
    </View>)}
    {!assignments.length && !error ? <Text style={styles.muted}>Aún no hay asignaciones registradas.</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar historial</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
