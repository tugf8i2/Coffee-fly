import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import SelectorFormulario from '../../componentes/comunes/SelectorFormulario';
import SelectorFecha from '../../componentes/comunes/SelectorFecha';
import { useEffect, useRef, useState } from 'react';
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

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
const apiFieldNames = {
  placa: 'Placa', tipo_vehiculo: 'Tipo de vehículo', modelo: 'Año del modelo', marca: 'Marca',
  modelo_comercial: 'Modelo comercial', configuracion: 'Configuración vehicular', numero_ejes: 'Número de ejes',
  tara_kg: 'Tara', pbv_homologado_kg: 'PBV homologado', soat_vencimiento: 'Vencimiento del SOAT',
  tecnomecanica_vencimiento: 'Vencimiento de técnico-mecánica', seguro_vencimiento: 'Vencimiento del seguro',
};

export function erroresFormularioVehiculo(form, catalog) {
  const errors = [];
  const plate = form.placa.trim();
  const modelYear = Number(form.modelo);
  const configuration = catalog.find((item) => item.codigo === form.configuracion);
  const tara = Number(form.tara_kg);
  const pbv = Number(form.pbv_homologado_kg);
  if (!plate) errors.push('Placa: es obligatoria.');
  else if (!/^[A-Z0-9-]{5,7}$/i.test(plate)) errors.push('Placa: usa entre 5 y 7 letras, números o guion (por ejemplo, ABC123).');
  if (!form.tipo_vehiculo) errors.push('Tipo de vehículo: selecciona una opción.');
  else if (!vehicleTypes.includes(form.tipo_vehiculo)) errors.push('Tipo de vehículo: la opción seleccionada no es válida.');
  if (!form.marca.trim()) errors.push('Marca: es obligatoria.');
  if (!form.modelo_comercial.trim()) errors.push('Modelo comercial: es obligatorio.');
  if (!form.modelo.trim()) errors.push('Año del modelo: es obligatorio.');
  else if (!Number.isInteger(modelYear) || form.modelo.length !== 4 || modelYear < 2000 || modelYear > new Date().getFullYear() + 1) errors.push(`Año del modelo: escribe un año entre 2000 y ${new Date().getFullYear() + 1}.`);
  if (!configuration) errors.push('Configuración vehicular: selecciona una opción del catálogo.');
  else {
    const compatible = { liviano: ['Camioneta', 'Van'], rigido: ['Camión'], articulado: ['Tractomula'] }[configuration.clase_vehiculo] || [];
    if (form.tipo_vehiculo && !compatible.includes(form.tipo_vehiculo)) errors.push(`Configuración vehicular: ${configuration.codigo} no corresponde a un vehículo tipo ${form.tipo_vehiculo}.`);
  }
  if (!form.tara_kg) errors.push('Tara: es obligatoria.');
  else if (!Number.isFinite(tara) || tara <= 0) errors.push('Tara: debe ser un número mayor que cero.');
  if (!form.pbv_homologado_kg) errors.push('PBV homologado: es obligatorio.');
  else if (!Number.isFinite(pbv) || pbv <= 0) errors.push('PBV homologado: debe ser un número mayor que cero.');
  else if (Number.isFinite(tara) && tara > 0 && pbv <= tara) errors.push('PBV homologado: debe ser mayor que la tara para obtener una capacidad útil positiva.');
  else if (configuration?.pbv_maximo_legal_kg && Number.isFinite(tara) && tara >= configuration.pbv_maximo_legal_kg) errors.push(`Tara: debe ser menor que el PBV máximo legal de ${configuration.pbv_maximo_legal_kg.toLocaleString('es-CO')} kg para ${configuration.codigo}.`);
  [['SOAT', form.soat_vencimiento], ['Técnico-mecánica', form.tecnomecanica_vencimiento], ['Seguro', form.seguro_vencimiento]].forEach(([label, value]) => {
    if (!value) errors.push(`${label}: selecciona la fecha de vencimiento.`);
    else if (!validDate(value)) errors.push(`${label}: la fecha seleccionada no es válida.`);
  });
  return errors;
}

function apiErrorMessage(data) {
  const issues = Array.isArray(data?.errors) ? data.errors : Array.isArray(data?.detail) ? data.detail : null;
  if (issues?.length) return issues.map((item) => {
    const rawField = String(item.field || item.loc?.at(-1) || '').replace(/^body\./, '');
    const field = apiFieldNames[rawField] || rawField || 'Dato';
    return `${field}: ${item.message || item.msg || 'valor inválido'}.`;
  }).join('\n');
  return typeof data?.detail === 'string' ? data.detail : 'El servidor no pudo guardar el vehículo. Revisa los datos e inténtalo nuevamente.';
}

export default function GestionVehiculos({ go, token }) {
  const pageRef = useRef(null);
  const [vehicles, setVehicles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [messageAttempt, setMessageAttempt] = useState(0);
  const setMessage = (text, type = 'error') => {
    setMessageText(text); setMessageType(type); setMessageAttempt((current) => current + 1);
    globalThis.requestAnimationFrame?.(() => pageRef.current?.scrollTo({ y: 0, animated: true }));
  };
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
    const validationErrors = erroresFormularioVehiculo(form, catalog);
    if (validationErrors.length) {
      setMessage(`Corrige ${validationErrors.length === 1 ? 'este dato' : `estos ${validationErrors.length} datos`} antes de guardar:\n• ${validationErrors.join('\n• ')}`);
      return;
    }
    setSaving(true);
    try {
      const modelYear = Number(form.modelo);
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
      if (!response.ok) throw Error(apiErrorMessage(data));
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

  return <ScrollView ref={pageRef} contentContainerStyle={styles.page}>
    <Text style={styles.title}>{editing ? 'Editar vehículo' : 'Registro de vehículos'}</Text>
    <Text style={styles.muted}>El registrador crea vehículos. El coordinador asigna vehículo y conductor; solo el conductor inicia el viaje.</Text>
    {message ? <FeedbackMessage key={messageAttempt} type={messageType}>{message}</FeedbackMessage> : null}
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
      {[['Vencimiento del SOAT', 'soat_vencimiento'], ['Vencimiento de técnico-mecánica', 'tecnomecanica_vencimiento'], ['Vencimiento del seguro', 'seguro_vencimiento']].map(([label, key]) => <SelectorFecha key={key} label={label} value={form[key]} onChange={(value) => set(key, value)} styles={styles} />)}
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
