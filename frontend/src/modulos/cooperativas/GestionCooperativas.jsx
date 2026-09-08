import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import CooperativeLocationPicker from '../../componentes/mapas/SelectorUbicacionCooperativa';

const empty = {
  nombre: '', telefono: '', correo: '', departamento: '', ciudad: '', direccion: '', latitude: '', longitude: '',
};

function errorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) return data.detail.map((item) => item.msg).join('. ');
  return fallback;
}

const firstValue = (...values) => values.find((value) => String(value || '').trim()) || '';
const limitedAddress = (value) => String(value || '').trim().slice(0, 250);

function addressFromExpo(address = {}) {
  const street = [address.street, address.streetNumber].filter(Boolean).join(' ');
  const zone = firstValue(address.district, address.subregion, address.name);
  return {
    departamento: firstValue(address.region),
    ciudad: firstValue(address.city, address.subregion, address.district),
    direccion: limitedAddress(firstValue([street, zone].filter(Boolean).join(', '), address.formattedAddress, address.name)),
  };
}

function addressFromNominatim(result = {}) {
  const address = result.address || {};
  const street = [address.road, address.house_number].filter(Boolean).join(' ');
  const zone = firstValue(address.neighbourhood, address.suburb, address.quarter, address.hamlet, address.village);
  return {
    departamento: firstValue(address.state, address.region),
    ciudad: firstValue(address.city, address.town, address.municipality, address.village, address.county),
    direccion: limitedAddress(firstValue([street, zone].filter(Boolean).join(', '), zone, result.display_name)),
  };
}

export default function GestionCooperativas({ go, token, styles }) {
  const [cooperatives, setCooperatives] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const lastGeocodeAt = useRef(0);
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
  const completeAddress = async (latitude, longitude) => {
    setGeocoding(true);
    try {
      let address;
      if (Platform.OS === 'web') {
        const delay = Math.max(0, 1100 - (Date.now() - lastGeocodeAt.current));
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        lastGeocodeAt.current = Date.now();
        const endpoint = process.env.EXPO_PUBLIC_REVERSE_GEOCODING_URL || 'https://nominatim.openstreetmap.org/reverse';
        const response = await fetch(`${endpoint}?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&addressdetails=1&accept-language=es`);
        if (!response.ok) throw Error('El servicio de direcciones no está disponible.');
        address = addressFromNominatim(await response.json());
      } else {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        address = addressFromExpo(results[0]);
      }
      setForm((current) => ({
        ...current,
        departamento: address.departamento || current.departamento,
        ciudad: address.ciudad || current.ciudad,
        direccion: address.direccion || current.direccion,
      }));
      return Boolean(address.departamento || address.ciudad || address.direccion);
    } catch {
      return false;
    } finally {
      setGeocoding(false);
    }
  };
  const selectMapLocation = async ({ latitude, longitude }) => {
    setForm((current) => ({
      ...current,
      latitude: Number(latitude).toFixed(6),
      longitude: Number(longitude).toFixed(6),
    }));
    const completed = await completeAddress(Number(latitude), Number(longitude));
    notify(completed
      ? 'Ubicación seleccionada en el mapa y datos de la zona completados.'
      : 'Ubicación seleccionada. Completa o verifica la dirección manualmente.');
  };
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
      const completed = await completeAddress(location.coords.latitude, location.coords.longitude);
      setShowMap(true);
      notify(completed
        ? 'Ubicación actual detectada. Verifica el barrio o zona y ajusta el marcador si es necesario.'
        : 'Coordenadas capturadas. Completa la dirección o selecciónala manualmente en el mapa.');
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
      setShowMap(false);
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
    setShowMap(true);
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
    {message ? <FeedbackMessage type={hasError ? "error" : "success"}>{message}</FeedbackMessage> : null}
    <View style={styles.formCard}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={form.nombre} onChangeText={(value) => set('nombre', value)} maxLength={50} placeholder="Cooperativa cafetera" />
      <Text style={styles.label}>Teléfono</Text>
      <TextInput style={styles.input} value={form.telefono} onChangeText={(value) => set('telefono', value.replace(/\D/g, ''))} maxLength={10} keyboardType="phone-pad" placeholder="3001234567" />
      <Text style={styles.label}>Correo</Text>
      <TextInput style={styles.input} value={form.correo} onChangeText={(value) => set('correo', value)} maxLength={50} keyboardType="email-address" autoCapitalize="none" placeholder="contacto@cooperativa.com" />
      <Text style={styles.section}>Ubicación</Text>
      <Text style={styles.muted}>Puedes detectar tu ubicación para completar los datos automáticamente o elegir el punto exacto en el mapa.</Text>
      <View style={styles.locationActions}>
        <TouchableOpacity style={styles.primary} disabled={locating || geocoding} onPress={captureLocation}><Text style={styles.primaryText}>{locating ? 'Obteniendo GPS…' : geocoding ? 'Buscando barrio o zona…' : 'Usar mi ubicación actual'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setShowMap((visible) => !visible)}><Text style={styles.secondaryText}>{showMap ? 'Ocultar mapa' : 'Elegir ubicación en el mapa'}</Text></TouchableOpacity>
      </View>
      {showMap ? <CooperativeLocationPicker latitude={form.latitude} longitude={form.longitude} onSelect={selectMapLocation} /> : null}
      {geocoding ? <Text style={styles.muted}>Consultando departamento, municipio y barrio o zona…</Text> : null}
      <Text style={styles.label}>Departamento</Text>
      <TextInput style={styles.input} value={form.departamento} onChangeText={(value) => set('departamento', value)} maxLength={50} placeholder="Huila" />
      <Text style={styles.label}>Municipio o ciudad</Text>
      <TextInput style={styles.input} value={form.ciudad} onChangeText={(value) => set('ciudad', value)} maxLength={50} placeholder="Pitalito" />
      <Text style={styles.label}>Dirección, barrio o zona</Text>
      <TextInput style={[styles.input, styles.textArea]} value={form.direccion} onChangeText={(value) => set('direccion', value)} multiline maxLength={250} placeholder="Barrio, vereda, vía o punto de referencia" />
      <Text style={styles.label}>Latitud</Text>
      <TextInput style={styles.input} value={form.latitude} onChangeText={(value) => set('latitude', value.replace(/[^0-9.-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder="1.8537" />
      <Text style={styles.label}>Longitud</Text>
      <TextInput style={styles.input} value={form.longitude} onChangeText={(value) => set('longitude', value.replace(/[^0-9.-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder="-76.0507" />
      <TouchableOpacity style={[styles.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}><Text style={styles.primaryText}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar cooperativa'}</Text></TouchableOpacity>
      {editing ? <TouchableOpacity onPress={() => { setEditing(null); setForm(empty); setShowMap(false); notify('Edición cancelada.'); }}><Text style={styles.link}>Cancelar edición</Text></TouchableOpacity> : null}
    </View>
    <Text style={styles.section}>Cooperativas registradas</Text>
    <View style={styles.grid}>{cooperatives.map((cooperative) => <View key={cooperative.id_cooperativa} style={styles.card}>
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
    </View>)}</View>
    {!cooperatives.length ? <Text style={styles.muted}>No hay cooperativas registradas.</Text> : null}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
