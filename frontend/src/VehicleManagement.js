import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from './config';

const empty = {
  placa: '', tipo_vehiculo: '', modelo: '', capacidad_toneladas: '', estado_vehiculo: 'disponible',
};

export default function VehicleManagement({ go, token, styles }) {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/vehiculos/`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudieron consultar los vehículos.');
      setVehicles(data);
    } catch (error) { setMessage(error.message); }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm({ ...form, [key]: key === 'placa' ? value.toUpperCase() : value });
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const toneladas = Number(form.capacidad_toneladas);
      if (!form.placa.trim() || !form.tipo_vehiculo.trim() || !form.modelo.trim() || !Number.isFinite(toneladas) || toneladas <= 0) {
        throw Error('Completa placa, tipo, modelo y capacidad.');
      }
      const payload = {
        placa: form.placa,
        tipo_vehiculo: form.tipo_vehiculo,
        modelo: form.modelo,
        capacidad_kg: toneladas * 1000,
      };
      if (form.estado_vehiculo !== 'en camino') payload.estado_vehiculo = form.estado_vehiculo;
      const response = await fetchApi(`${API_BASE_URL}/vehiculos/${editing || ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo guardar el vehículo.');
      setMessage(editing ? 'Vehículo actualizado correctamente.' : `Vehículo ${data.placa} registrado correctamente.`);
      setForm(empty);
      setEditing(null);
      await load();
    } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  };
  const edit = (vehicle) => {
    setEditing(vehicle.id_vehiculo);
    setForm({
      placa: vehicle.placa,
      tipo_vehiculo: vehicle.tipo_vehiculo,
      modelo: vehicle.modelo || '',
      capacidad_toneladas: String(vehicle.capacidad_kg / 1000),
      estado_vehiculo: vehicle.estado_vehiculo || 'disponible',
    });
  };
  const remove = async (vehicle) => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/vehiculos/${vehicle.id_vehiculo}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo eliminar el vehículo.');
      setMessage(`Vehículo ${vehicle.placa} eliminado.`);
      await load();
    } catch (error) { setMessage(error.message); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>{editing ? 'Editar vehículo' : 'Registro de vehículos'}</Text>
    <Text style={styles.muted}>El registrador crea vehículos. El coordinador asigna vehículo y conductor; solo el conductor inicia el viaje.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.label}>Placa</Text>
      <TextInput style={styles.input} value={form.placa} onChangeText={(value) => set('placa', value)} maxLength={7} autoCapitalize="characters" placeholder="ABC123" />
      <Text style={styles.label}>Tipo de vehículo</Text>
      <TextInput style={styles.input} value={form.tipo_vehiculo} onChangeText={(value) => set('tipo_vehiculo', value)} placeholder="Camioneta, camión..." />
      <Text style={styles.label}>Modelo</Text>
      <TextInput style={styles.input} value={form.modelo} onChangeText={(value) => set('modelo', value)} placeholder="Ej. NPR, FTR" />
      <Text style={styles.label}>Capacidad (toneladas)</Text>
      <TextInput style={styles.input} value={form.capacidad_toneladas} onChangeText={(value) => set('capacidad_toneladas', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      {form.estado_vehiculo === 'en camino' ? <Text style={styles.muted}>Estado: En camino. Solo cambia desde la entrega del conductor.</Text> : <>
        <Text style={styles.label}>Estado operativo</Text>
        <View style={styles.statusActions}>{['disponible', 'en mantenimiento'].map((state) => <TouchableOpacity key={state} style={[styles.role, form.estado_vehiculo === state && styles.roleActive]} onPress={() => set('estado_vehiculo', state)}><Text>{state}</Text></TouchableOpacity>)}</View>
      </>}
      <TouchableOpacity style={[styles.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}><Text style={styles.primaryText}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar vehículo'}</Text></TouchableOpacity>
      {editing ? <TouchableOpacity onPress={() => { setEditing(null); setForm(empty); }}><Text style={styles.link}>Cancelar edición</Text></TouchableOpacity> : null}
    </View>
    <Text style={styles.section}>Vehículos registrados</Text>
    {vehicles.map((vehicle) => <View key={vehicle.id_vehiculo} style={styles.card}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      <Text>Modelo: {vehicle.modelo || 'Sin modelo'}</Text>
      <Text>Capacidad: {vehicle.capacidad_kg / 1000} t</Text>
      <Text>Estado: {vehicle.estado_vehiculo}</Text>
      <TouchableOpacity style={styles.primary} onPress={() => edit(vehicle)}><Text style={styles.primaryText}>Editar vehículo</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => remove(vehicle)}><Text style={styles.error}>Eliminar vehículo</Text></TouchableOpacity>
    </View>)}
    {!vehicles.length ? <Text style={styles.muted}>No hay vehículos registrados.</Text> : null}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
