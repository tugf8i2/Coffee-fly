import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './config';

const initialForm = { placa: '', tipo_vehiculo: '', modelo: '', capacidad_toneladas: '', estado_vehiculo: 'disponible' };

export default function VehicleManagement({ go, token, styles }) {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/vehiculos/`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudieron consultar los vehículos.');
      setVehicles(data);
    } catch (error) { setMessage(error.message); }
  };
  useEffect(() => { load(); }, []);
  const set = (key, value) => setForm({ ...form, [key]: key === 'placa' ? value.toUpperCase() : value });
  const save = async () => {
    if (!form.placa.trim() || !form.tipo_vehiculo.trim() || !form.modelo.trim() || !form.capacidad_toneladas) return setMessage('Completa placa, tipo, modelo y capacidad.');
    const toneladas = Number(form.capacidad_toneladas);
    if (!Number.isFinite(toneladas) || toneladas <= 0) return setMessage('La capacidad debe ser un número de toneladas mayor que cero.');
    const response = await fetch(`${API_BASE_URL}/vehiculos/`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa: form.placa, tipo_vehiculo: form.tipo_vehiculo, modelo: form.modelo, estado_vehiculo: form.estado_vehiculo, capacidad_kg: toneladas * 1000 }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.detail || 'No se pudo registrar el vehículo.');
    setMessage(`Vehículo ${result.placa} registrado correctamente.`);
    setForm(initialForm); load();
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Registro de vehículos</Text>
    <Text style={styles.muted}>Registra los vehículos disponibles para el transporte de café.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.label}>Placa</Text><TextInput style={styles.input} value={form.placa} onChangeText={(v) => set('placa', v)} maxLength={7} autoCapitalize="characters" placeholder="ABC123" />
      <Text style={styles.label}>Tipo de vehículo</Text><TextInput style={styles.input} value={form.tipo_vehiculo} onChangeText={(v) => set('tipo_vehiculo', v)} placeholder="Camioneta, camión..." />
      <Text style={styles.label}>Modelo</Text><TextInput style={styles.input} value={form.modelo} onChangeText={(v) => set('modelo', v)} placeholder="Ej. NPR, FTR, Actros" />
      <Text style={styles.label}>Capacidad (toneladas)</Text><TextInput style={styles.input} value={form.capacidad_toneladas} onChangeText={(v) => set('capacidad_toneladas', v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Ej. 2.5" />
      <Text style={styles.label}>Estado</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['disponible', 'en camino', 'en mantenimiento'].map((state) => <TouchableOpacity key={state} style={[styles.role, form.estado_vehiculo === state && styles.roleActive]} onPress={() => set('estado_vehiculo', state)}><Text>{state}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={styles.primary} onPress={save}><Text style={styles.primaryText}>Registrar vehículo</Text></TouchableOpacity>
    </View>
    <Text style={styles.section}>Vehículos registrados</Text>
    {vehicles.map((vehicle) => <View style={styles.card} key={vehicle.id_vehiculo}><Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text><Text>Modelo: {vehicle.modelo || 'Sin registrar'}</Text><Text>Capacidad: {vehicle.capacidad_kg / 1000} t</Text><Text style={styles.muted}>Estado: {vehicle.estado_vehiculo || 'disponible'}</Text></View>)}
    {!vehicles.length ? <Text style={styles.muted}>Aún no hay vehículos registrados.</Text> : null}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
