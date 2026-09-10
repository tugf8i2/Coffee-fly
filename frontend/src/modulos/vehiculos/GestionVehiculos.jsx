import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import { styles } from './GestionVehiculos.styles';

const empty = {
  placa: '', tipo_vehiculo: '', modelo: '', capacidad_toneladas: '', estado_vehiculo: 'disponible',
};
const vehicleTypes = ['Camión', 'Tractomula'];

export default function GestionVehiculos({ go, token }) {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const [saving, setSaving] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
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
      const modelYear = Number(form.modelo);
      if (!form.placa.trim() || !vehicleTypes.includes(form.tipo_vehiculo) || !form.modelo.trim() || !Number.isFinite(toneladas) || toneladas <= 0) {
        throw Error('Completa placa, tipo, modelo y capacidad.');
      }
      if (!Number.isInteger(modelYear) || modelYear < 2000) {
        throw Error('El modelo debe ser un año igual o posterior a 2000.');
      }
      const payload = {
        placa: form.placa,
        tipo_vehiculo: form.tipo_vehiculo,
        modelo: String(modelYear),
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
      setMessage(editing ? 'Vehículo actualizado correctamente.' : `Vehículo ${data.placa} registrado correctamente.`, 'success');
      setForm(empty);
      setTypeMenuOpen(false);
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
      setMessage(`Vehículo ${vehicle.placa} eliminado.`, 'success');
      await load();
    } catch (error) { setMessage(error.message); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>{editing ? 'Editar vehículo' : 'Registro de vehículos'}</Text>
    <Text style={styles.muted}>El registrador crea vehículos. El coordinador asigna vehículo y conductor; solo el conductor inicia el viaje.</Text>
    {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}
    <View style={styles.formCard}>
      <Text style={styles.label}>Placa</Text>
      <TextInput style={styles.input} value={form.placa} onChangeText={(value) => set('placa', value)} maxLength={7} autoCapitalize="characters" placeholder="ABC123" />
      <Text style={styles.label}>Tipo de vehículo</Text>
      <TouchableOpacity style={styles.input} onPress={() => setTypeMenuOpen((current) => !current)}><Text>{form.tipo_vehiculo || 'Selecciona un tipo'} ▾</Text></TouchableOpacity>
      {typeMenuOpen ? <View style={styles.card}>{vehicleTypes.map((type) => <TouchableOpacity key={type} onPress={() => { set('tipo_vehiculo', type); setTypeMenuOpen(false); }}><Text style={styles.link}>{type}</Text></TouchableOpacity>)}</View> : null}
      <Text style={styles.label}>Año del modelo</Text>
      <TextInput style={styles.input} value={form.modelo} onChangeText={(value) => set('modelo', value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} placeholder="Ej. 2024" />
      <Text style={styles.muted}>Se permiten modelos del año 2000 en adelante.</Text>
      <Text style={styles.label}>Capacidad (toneladas)</Text>
      <TextInput style={styles.input} value={form.capacidad_toneladas} onChangeText={(value) => set('capacidad_toneladas', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      {form.estado_vehiculo === 'en camino' ? <Text style={styles.muted}>Estado: En camino. Solo cambia desde la entrega del conductor.</Text> : <>
        <Text style={styles.label}>Estado operativo</Text>
        <View style={styles.statusActions}>{['disponible', 'en mantenimiento'].map((state) => <TouchableOpacity key={state} style={[styles.role, form.estado_vehiculo === state && styles.roleActive]} onPress={() => set('estado_vehiculo', state)}><Text>{state}</Text></TouchableOpacity>)}</View>
      </>}
      <TouchableOpacity style={[styles.primary, saving && styles.saving]} disabled={saving} onPress={save}><Text style={styles.primaryText}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar vehículo'}</Text></TouchableOpacity>
      {editing ? <TouchableOpacity onPress={() => { setEditing(null); setForm(empty); }}><Text style={styles.link}>Cancelar edición</Text></TouchableOpacity> : null}
    </View>
    <Text style={styles.section}>Vehículos registrados</Text>
    <View style={styles.grid}>{vehicles.map((vehicle) => <View key={vehicle.id_vehiculo} style={styles.card}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      <Text>Modelo: {vehicle.modelo || 'Sin modelo'}</Text>
      <Text>Capacidad: {vehicle.capacidad_kg / 1000} t</Text>
      <Text>Estado: {vehicle.estado_vehiculo}</Text>
      <TouchableOpacity style={styles.primary} onPress={() => edit(vehicle)}><Text style={styles.primaryText}>Editar vehículo</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => remove(vehicle)}><Text style={styles.error}>Eliminar vehículo</Text></TouchableOpacity>
    </View>)}</View>
    {!vehicles.length ? <Text style={styles.muted}>No hay vehículos registrados.</Text> : null}
  </ScrollView>;
}
