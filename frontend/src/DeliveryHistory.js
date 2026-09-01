import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from './config';

const statuses = ['todos', 'pendiente', 'en camino', 'entregado', 'cancelado'];

export default function DeliveryHistory({ token, go, styles }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [farmer, setFarmer] = useState(''); const [vehicle, setVehicle] = useState('');
  const [status, setStatus] = useState('todos'); const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, pagina: 1, tamano_pagina: 20 }); const [message, setMessage] = useState('');
  const load = useCallback(async (requestedPage = page) => {
    try {
      const query = new URLSearchParams({ pagina: String(requestedPage) });
      if (from) query.set('fecha_desde', `${from}T00:00:00`);
      if (to) query.set('fecha_hasta', `${to}T23:59:59`);
      if (farmer) query.set('caficultor_id', farmer);
      if (vehicle) query.set('vehiculo_id', vehicle);
      if (status !== 'todos') query.set('estado', status);
      const response = await fetchApi(`${API_BASE_URL}/entregas/historial?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo consultar el historial.');
      setResult(data); setPage(requestedPage); setMessage('');
    } catch (error) { setMessage(error.message); }
  }, [from, to, farmer, vehicle, status, token, page]);
  useEffect(() => { load(1); }, []);
  const pages = Math.max(1, Math.ceil(result.total / 20));
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Historial de entregas</Text>
    <Text style={styles.muted}>Filtra por fechas (máximo 90 días), caficultor, estado y vehículo. Los resultados se muestran de 20 en 20.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.label}>Desde (AAAA-MM-DD)</Text><TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="2026-08-01" />
      <Text style={styles.label}>Hasta (AAAA-MM-DD)</Text><TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="2026-08-28" />
      <Text style={styles.label}>ID de caficultor</Text><TextInput style={styles.input} value={farmer} onChangeText={(v) => setFarmer(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Opcional" />
      <Text style={styles.label}>ID de vehículo</Text><TextInput style={styles.input} value={vehicle} onChangeText={(v) => setVehicle(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Opcional" />
      <Text style={styles.label}>Estado</Text><View style={styles.statusActions}>{statuses.map((item) => <TouchableOpacity key={item} style={[styles.role, status === item && styles.roleActive]} onPress={() => setStatus(item)}><Text>{item}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={styles.primary} onPress={() => load(1)}><Text style={styles.primaryText}>Aplicar filtros</Text></TouchableOpacity>
    </View>
    <Text style={styles.muted}>{result.total} entrega(s) encontrada(s).</Text>
    {result.items.map((item) => <View key={item.id_entrega} style={styles.card}><Text style={styles.cardTitle}>{item.caficultor_nombre} · {item.cantidad_kg} kg</Text><Text>Estado: {item.estado_entrega}</Text><Text>Vehículo: {item.vehiculo_placa || 'Sin asignar'}</Text><Text>Fecha: {new Date(item.fecha_hora_entrega).toLocaleString()}</Text>{item.observaciones ? <Text>Observaciones: {item.observaciones}</Text> : null}</View>)}
    {!result.items.length ? <Text style={styles.muted}>No hay entregas que coincidan con estos filtros.</Text> : null}
    <View style={styles.statusActions}><TouchableOpacity style={styles.statusButton} disabled={page <= 1} onPress={() => load(page - 1)}><Text style={styles.statusButtonText}>Anterior</Text></TouchableOpacity><Text style={styles.label}>Página {page} de {pages}</Text><TouchableOpacity style={styles.statusButton} disabled={page >= pages} onPress={() => load(page + 1)}><Text style={styles.statusButtonText}>Siguiente</Text></TouchableOpacity></View>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
