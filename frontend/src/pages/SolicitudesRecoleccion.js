import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL } from '../config/Api';

const initialDate = () => new Date().toISOString().slice(0, 16);

export default function SolicitudesRecoleccion({ go, token, styles }) {
  const [requests, setRequests] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [kg, setKg] = useState('');
  const [dateTime, setDateTime] = useState(initialDate());
  const [observations, setObservations] = useState('');
  const [message, setMessage] = useState('');

  const headers = { Authorization: `Bearer ${token}` };
  const load = async () => {
    try {
      const [requestsResponse, deliveriesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/entregas/solicitudes-disponibles`, { headers }),
        fetch(`${API_BASE_URL}/entregas/hoy`, { headers }),
      ]);
      const requestsData = await requestsResponse.json();
      const deliveriesData = await deliveriesResponse.json();
      if (!requestsResponse.ok) throw Error(requestsData.detail || 'No se pudieron consultar las solicitudes');
      if (!deliveriesResponse.ok) throw Error(deliveriesData.detail || 'No se pudieron consultar las entregas');
      setRequests(requestsData);
      setDeliveries(deliveriesData);
    } catch (reason) { setMessage(reason.message); }
  };

  useEffect(() => { load(); }, []);

  const registerDelivery = async () => {
    if (!selectedRequest) return setMessage('Selecciona una solicitud activa.');
    if (!Number(kg) || Number(kg) <= 0) return setMessage('La cantidad debe ser mayor a cero.');
    const parsedDate = new Date(dateTime);
    if (Number.isNaN(parsedDate.getTime())) return setMessage('Usa una fecha válida en formato AAAA-MM-DDTHH:MM.');
    try {
      const response = await fetch(`${API_BASE_URL}/entregas/`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: selectedRequest.id_solicitud, cantidad_kg: Number(kg), fecha_hora: parsedDate.toISOString(), observaciones: observations || null }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo registrar la entrega');
      setMessage('Entrega registrada con estado Pendiente.');
      setSelectedRequest(null); setKg(''); setObservations(''); setDateTime(initialDate());
      load();
    } catch (reason) { setMessage(reason.message); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Registro de entrega de café</Text>
    <Text style={styles.muted}>Selecciona la solicitud activa del caficultor y registra la entrega. El vehículo se asigna después.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <Text style={styles.section}>Solicitudes activas</Text>
    {requests.map((request) => <TouchableOpacity key={request.id_solicitud} style={[styles.card, selectedRequest?.id_solicitud === request.id_solicitud && { borderWidth: 2, borderColor: '#386641' }]} onPress={() => setSelectedRequest(request)}>
      <Text style={styles.cardTitle}>Caficultor #{request.caficultor_id}</Text><Text>Solicitud: {request.id_solicitud.slice(0, 8)}</Text><Text>Registrada: {new Date(request.fecha_hora_solicitud).toLocaleString()}</Text>
    </TouchableOpacity>)}
    {!requests.length ? <Text style={styles.muted}>No hay solicitudes activas sin entrega registrada.</Text> : null}
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Nueva entrega</Text>
      <Text style={styles.label}>Cantidad en kilogramos</Text><TextInput style={styles.input} value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="Ej. 125.50" />
      <Text style={styles.label}>Fecha y hora</Text><TextInput style={styles.input} value={dateTime} onChangeText={setDateTime} placeholder="AAAA-MM-DDTHH:MM" />
      <Text style={styles.label}>Observaciones (opcional)</Text><TextInput style={styles.input} value={observations} onChangeText={setObservations} placeholder="Observaciones de la entrega" />
      <TouchableOpacity style={styles.primary} onPress={registerDelivery}><Text style={styles.primaryText}>Registrar entrega</Text></TouchableOpacity>
    </View>
    <Text style={styles.section}>Entregas del día</Text>
    {deliveries.map((delivery) => <View style={styles.card} key={delivery.id_entrega}><Text style={styles.cardTitle}>{delivery.caficultor_nombre}</Text><Text>{delivery.cantidad_kg} kg - {delivery.estado_entrega}</Text><Text>{new Date(delivery.fecha_hora).toLocaleString()}</Text>{delivery.observaciones ? <Text style={styles.muted}>{delivery.observaciones}</Text> : null}</View>)}
    {!deliveries.length ? <Text style={styles.muted}>Aún no hay entregas registradas hoy.</Text> : null}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
