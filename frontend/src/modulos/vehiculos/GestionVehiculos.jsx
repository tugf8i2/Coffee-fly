import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import SelectorFormulario from '../../componentes/comunes/SelectorFormulario';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import { alertaVencimiento } from '../../servicios/alertasDocumentales';
import { styles } from './GestionVehiculos.styles';

const empty = {
  placa: '', tipo_vehiculo: '', marca: '', modelo_comercial: '', modelo: '', color: '',
  tipo_servicio: 'PUBLICO', configuracion: '', numero_ejes: '', tipo_carroceria: '',
  tara_kg: '', pbv_homologado_kg: '', soat_vencimiento: '',
  tecnomecanica_vencimiento: '', seguro_vencimiento: '', estado_vehiculo: 'disponible',
};
const vehicleTypes = ['Camioneta', 'Van', 'Camión', 'Tractomula'];

export default function GestionVehiculos({ go, token }) {
  const [vehicles, setVehicles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const [response, catalogResponse] = await Promise.all([
        fetchApi(`${API_BASE_URL}/vehiculos/`, { headers }),
        fetchApi(`${API_BASE_URL}/vehiculos/catalogo`, { headers }),
      ]);
      const [data, catalogData] = await Promise.all([response.json(), catalogResponse.json()]);
      if (!response.ok || !catalogResponse.ok) throw Error(data.detail || catalogData.detail || 'No se pudieron consultar los vehículos.');
      setVehicles(data);
      setCatalog(catalogData.filter((item) => item.activo));
    } catch (error) { setMessage(error.message); }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: key === 'placa' ? value.toUpperCase() : value,
    ...(key === 'configuracion' ? { numero_ejes: String(catalog.find((item) => item.codigo === value)?.numero_ejes || '') } : {}),
  }));
  const configuration = catalog.find((item) => item.codigo === form.configuracion);
  const pbv = Number(form.pbv_homologado_kg);
  const tara = Number(form.tara_kg);
  const limit = configuration && pbv > 0 ? Math.min(pbv, configuration.pbv_maximo_legal_kg || pbv) : null;
  const calculated = limit != null && tara > 0 ? limit - tara : null;
  const license = configuration?.[form.tipo_servicio === 'PUBLICO' ? 'licencia_publico' : 'licencia_particular'];
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const modelYear = Number(form.modelo);
      if (!form.placa.trim() || !vehicleTypes.includes(form.tipo_vehiculo) || !form.modelo.trim() || !configuration || !form.marca.trim() || !form.modelo_comercial.trim()) {
        throw Error('Completa placa, marca, modelo, año y configuración.');
      }
      if (!Number.isInteger(modelYear) || modelYear < 2000) {
        throw Error('El modelo debe ser un año igual o posterior a 2000.');
      }
      if (calculated == null || calculated <= 0) throw Error('La tara debe ser menor que el PBV homologado y el máximo legal.');
      if (!form.soat_vencimiento || !form.tecnomecanica_vencimiento || !form.seguro_vencimiento) throw Error('Registra el vencimiento de SOAT, técnico-mecánica y seguro.');
      const payload = {
        placa: form.placa.trim(),
        tipo_vehiculo: form.tipo_vehiculo,
        modelo: String(modelYear),
        marca: form.marca.trim(), modelo_comercial: form.modelo_comercial.trim(), color: form.color.trim() || null,
        tipo_servicio: form.tipo_servicio, configuracion: form.configuracion,
        numero_ejes: form.numero_ejes ? Number(form.numero_ejes) : null,
        tipo_carroceria: form.tipo_carroceria.trim() || null,
        tara_kg: tara, pbv_homologado_kg: pbv,
        soat_vencimiento: form.soat_vencimiento,
        tecnomecanica_vencimiento: form.tecnomecanica_vencimiento,
        seguro_vencimiento: form.seguro_vencimiento,
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
      marca: vehicle.marca || '', modelo_comercial: vehicle.modelo_comercial || '',
      color: vehicle.color || '', tipo_servicio: vehicle.tipo_servicio || 'PUBLICO',
      configuracion: vehicle.configuracion || '', numero_ejes: String(vehicle.numero_ejes || ''),
      tipo_carroceria: vehicle.tipo_carroceria || '',
      tara_kg: String(vehicle.tara_kg || ''), pbv_homologado_kg: String(vehicle.pbv_homologado_kg || ''),
      soat_vencimiento: vehicle.soat_vencimiento || '',
      tecnomecanica_vencimiento: vehicle.tecnomecanica_vencimiento || '',
      seguro_vencimiento: vehicle.seguro_vencimiento || '',
      estado_vehiculo: vehicle.estado_vehiculo || 'disponible',
    });
  };
  const remove = async (vehicle) => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/vehiculos/${vehicle.id_vehiculo}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo eliminar el vehículo.');
      setMessage(`Vehículo ${vehicle.placa} desactivado; se conservó su historial.`, 'success');
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
      <SelectorFormulario label="Tipo de vehículo" value={form.tipo_vehiculo} onValueChange={(value) => set('tipo_vehiculo', value)} options={vehicleTypes.map((type) => [type, type])} placeholder="Selecciona un tipo" disabled={saving} />
      <Text style={styles.label}>Año del modelo</Text>
      <TextInput style={styles.input} value={form.modelo} onChangeText={(value) => set('modelo', value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} placeholder="Ej. 2024" />
      <Text style={styles.muted}>Se permiten modelos del año 2000 en adelante.</Text>
      <Text style={styles.label}>Marca</Text>
      <TextInput style={styles.input} value={form.marca} onChangeText={(value) => set('marca', value)} placeholder="Chevrolet" />
      <Text style={styles.label}>Modelo comercial</Text>
      <TextInput style={styles.input} value={form.modelo_comercial} onChangeText={(value) => set('modelo_comercial', value)} placeholder="NPR" />
      <Text style={styles.label}>Color</Text>
      <TextInput style={styles.input} value={form.color} onChangeText={(value) => set('color', value)} />
      <Text style={styles.label}>Tipo de servicio</Text>
      <SelectorFormulario label="Tipo de servicio" value={form.tipo_servicio} onValueChange={(value) => set('tipo_servicio', value)} options={[["PUBLICO", "Público"], ["PARTICULAR", "Particular"]]} />
      <Text style={styles.label}>Configuración vehicular</Text>
      <SelectorFormulario label="Configuración vehicular" value={form.configuracion} onValueChange={(value) => set('configuracion', value)} options={catalog.map((item) => [item.codigo, `${item.codigo} · ${item.descripcion}`])} placeholder="Selecciona una configuración" />
      <Text style={styles.label}>Número de ejes</Text>
      <TextInput style={styles.input} value={form.numero_ejes} onChangeText={(value) => set('numero_ejes', value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" editable={!configuration?.numero_ejes} />
      <Text style={styles.label}>Carrocería</Text>
      <TextInput style={styles.input} value={form.tipo_carroceria} onChangeText={(value) => set('tipo_carroceria', value)} />
      <Text style={styles.section}>Datos de peso · kilogramos</Text>
      <Text style={styles.label}>Tara (kg)</Text>
      <TextInput style={styles.input} value={form.tara_kg} onChangeText={(value) => set('tara_kg', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      <Text style={styles.label}>PBV homologado (kg)</Text>
      <TextInput style={styles.input} value={form.pbv_homologado_kg} onChangeText={(value) => set('pbv_homologado_kg', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      <Text>PBV máximo legal: {configuration?.pbv_maximo_legal_kg ? `${configuration.pbv_maximo_legal_kg.toLocaleString('es-CO')} kg` : 'Según homologación individual'}</Text>
      <Text>Capacidad útil estimada: {calculated != null && calculated > 0 ? `${calculated.toLocaleString('es-CO')} kg` : 'Completa tara y PBV'}</Text>
      <Text>Licencia mínima: {license || 'Selecciona configuración y servicio'}</Text>
      <Text style={styles.muted}>El servidor recalcula estos valores; no se puede editar directamente la capacidad.</Text>
      <Text style={styles.section}>Documentos · fechas de vencimiento</Text>
      {[['SOAT', 'soat_vencimiento'], ['Técnico-mecánica', 'tecnomecanica_vencimiento'], ['Seguro', 'seguro_vencimiento']].map(([label, key]) => <View key={key}>
        <Text style={styles.label}>{label}</Text>
        <TextInput style={styles.input} value={form[key]} onChangeText={(value) => set(key, value)} placeholder="AAAA-MM-DD" />
      </View>)}
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
      <Text>Configuración: {vehicle.configuracion || 'Pendiente de completar'}</Text>
      <Text>PBV homologado: {vehicle.pbv_homologado_kg?.toLocaleString('es-CO') || 'Pendiente'} kg · Tara: {vehicle.tara_kg?.toLocaleString('es-CO') || 'Pendiente'} kg</Text>
      <Text>Capacidad útil: {vehicle.documentacion_completa ? vehicle.capacidad_kg.toLocaleString('es-CO') + ' kg' : 'Pendiente de verificar'}</Text>
      <Text>Licencia mínima: {vehicle.licencia_minima_requerida || 'Pendiente'}</Text>
      <Text>SOAT: {alertaVencimiento(vehicle.soat_vencimiento)}</Text>
      <Text>Técnico-mecánica: {alertaVencimiento(vehicle.tecnomecanica_vencimiento)}</Text>
      <Text>Seguro: {alertaVencimiento(vehicle.seguro_vencimiento)}</Text>
      <Text>Estado: {vehicle.estado_vehiculo}</Text>
      <TouchableOpacity style={styles.primary} onPress={() => edit(vehicle)}><Text style={styles.primaryText}>Editar vehículo</Text></TouchableOpacity>
      {vehicle.estado_vehiculo !== 'inactivo' ? <TouchableOpacity onPress={() => remove(vehicle)}><Text style={styles.error}>Desactivar vehículo</Text></TouchableOpacity> : null}
    </View>)}</View>
    {!vehicles.length ? <Text style={styles.muted}>No hay vehículos registrados.</Text> : null}
  </ScrollView>;
}
