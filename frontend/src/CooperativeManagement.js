import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from './config';

const empty = {
  nombre: '', telefono: '', correo: '', departamento: '', ciudad: '', direccion: '', latitude: '', longitude: '',
};

function errorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) return data.detail.map((item) => item.msg).join('. ');
  return fallback;
}

export default function CooperativeManagement({ go, token, styles }) {
  const [cooperatives, setCooperatives] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const notify = (text, error = false) => { setMessage(text); setHasError(error); };
  const load = async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/cooperativas/`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(errorMessage(data, 'No se pudieron consultar las cooperativas.'));
      setCooperatives(data);
    } catch (error) { notify(error.message, true); }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const captureLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw Error('Debes autorizar la ubicación para capturar las coordenadas.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((current) => ({
        ...current,
        latitude: location.coords.latitude.toFixed(6),
        longitude: location.coords.longitude.toFixed(6),
      }));
      notify('Coordenadas capturadas. Completa la dirección de la cooperativa.');
    } catch (error) { notify(error.message || 'No fue posible obtener la ubicación.', true); } finally { setLocating(false); }
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      if (!form.nombre.trim() || !/^\d{10}$/.test(form.telefono) || !form.correo.trim()
        || !form.departamento.trim() || !form.ciudad.trim() || !form.direccion.trim()
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw Error('Completa todos los datos. El teléfono debe tener 10 dígitos y las coordenadas deben ser válidas.');
      }
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono,
        correo: form.correo.trim().toLowerCase(),
        ubicacion: {
          x: longitude,
          y: latitude,
          departamento: form.departamento.trim(),
          ciudad: form.ciudad.trim(),
          direccion: form.direccion.trim(),
        },
      };
      const response = await fetchApi(`${API_BASE_URL}/cooperativas/${editing || ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw Error(errorMessage(data, 'No se pudo guardar la cooperativa.'));
      notify(editing ? 'Cooperativa actualizada correctamente.' : 'Cooperativa registrada correctamente.');
      setForm(empty);
      setEditing(null);
      await load();
    } catch (error) { notify(error.message, true); } finally { setSaving(false); }
  };
  const edit = (cooperative) => {
    setEditing(cooperative.id_cooperativa);
    setPendingDelete(null);
    setForm({
      nombre: cooperative.nombre,
      telefono: cooperative.telefono,
      correo: cooperative.correo,
      departamento: cooperative.ubicacion.departamento,
      ciudad: cooperative.ubicacion.ciudad,
      direccion: cooperative.ubicacion.direccion,
      latitude: String(cooperative.ubicacion.y),
      longitude: String(cooperative.ubicacion.x),
    });
    notify('Editando cooperativa.');
  };
  const remove = async (cooperative) => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/cooperativas/${cooperative.id_cooperativa}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (!response.ok) throw Error(errorMessage(data, 'No se pudo eliminar la cooperativa.'));
      notify(`Cooperativa ${cooperative.nombre} eliminada.`);
      setPendingDelete(null);
      await load();
    } catch (error) { notify(error.message, true); }
  };

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>{editing ? 'Editar cooperativa' : 'Administrar cooperativas'}</Text>
    <Text style={styles.muted}>Registra los datos de contacto y el punto exacto donde opera cada cooperativa.</Text>
    {message ? <Text style={hasError ? styles.error : styles.success}>{message}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={form.nombre} onChangeText={(value) => set('nombre', value)} maxLength={50} placeholder="Cooperativa cafetera" />
      <Text style={styles.label}>Teléfono</Text>
      <TextInput style={styles.input} value={form.telefono} onChangeText={(value) => set('telefono', value.replace(/\D/g, ''))} maxLength={10} keyboardType="phone-pad" placeholder="3001234567" />
      <Text style={styles.label}>Correo</Text>
      <TextInput style={styles.input} value={form.correo} onChangeText={(value) => set('correo', value)} maxLength={50} keyboardType="email-address" autoCapitalize="none" placeholder="contacto@cooperativa.com" />
      <Text style={styles.section}>Ubicación</Text>
      <Text style={styles.label}>Departamento</Text>
      <TextInput style={styles.input} value={form.departamento} onChangeText={(value) => set('departamento', value)} maxLength={50} placeholder="Huila" />
      <Text style={styles.label}>Municipio o ciudad</Text>
      <TextInput style={styles.input} value={form.ciudad} onChangeText={(value) => set('ciudad', value)} maxLength={50} placeholder="Pitalito" />
      <Text style={styles.label}>Dirección o referencia</Text>
      <TextInput style={[styles.input, styles.textArea]} value={form.direccion} onChangeText={(value) => set('direccion', value)} multiline maxLength={250} placeholder="Vereda, vía o punto de referencia" />
      <TouchableOpacity style={styles.primary} disabled={locating} onPress={captureLocation}><Text style={styles.primaryText}>{locating ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}</Text></TouchableOpacity>
      <Text style={styles.label}>Latitud</Text>
      <TextInput style={styles.input} value={form.latitude} onChangeText={(value) => set('latitude', value.replace(/[^0-9.-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder="1.8537" />
      <Text style={styles.label}>Longitud</Text>
      <TextInput style={styles.input} value={form.longitude} onChangeText={(value) => set('longitude', value.replace(/[^0-9.-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder="-76.0507" />
      <TouchableOpacity style={[styles.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}><Text style={styles.primaryText}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar cooperativa'}</Text></TouchableOpacity>
      {editing ? <TouchableOpacity onPress={() => { setEditing(null); setForm(empty); notify('Edición cancelada.'); }}><Text style={styles.link}>Cancelar edición</Text></TouchableOpacity> : null}
    </View>
    <Text style={styles.section}>Cooperativas registradas</Text>
    {cooperatives.map((cooperative) => <View key={cooperative.id_cooperativa} style={styles.card}>
      <Text style={styles.cardTitle}>{cooperative.nombre}</Text>
      <Text>{cooperative.telefono} · {cooperative.correo}</Text>
      <Text>{cooperative.ubicacion.direccion}, {cooperative.ubicacion.ciudad}, {cooperative.ubicacion.departamento}</Text>
      <Text style={styles.muted}>GPS: {cooperative.ubicacion.y}, {cooperative.ubicacion.x}</Text>
      <TouchableOpacity style={styles.primary} onPress={() => edit(cooperative)}><Text style={styles.primaryText}>Editar cooperativa</Text></TouchableOpacity>
      {pendingDelete === cooperative.id_cooperativa ? <View style={styles.card}>
        <Text style={styles.error}>¿Eliminar definitivamente esta cooperativa?</Text>
        <TouchableOpacity onPress={() => remove(cooperative)}><Text style={styles.error}>Sí, eliminar</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setPendingDelete(null)}><Text style={styles.link}>Cancelar</Text></TouchableOpacity>
      </View> : <TouchableOpacity onPress={() => setPendingDelete(cooperative.id_cooperativa)}><Text style={styles.error}>Eliminar cooperativa</Text></TouchableOpacity>}
    </View>)}
    {!cooperatives.length ? <Text style={styles.muted}>No hay cooperativas registradas.</Text> : null}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
