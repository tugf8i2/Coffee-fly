import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import CampoFormulario from '../../componentes/comunes/CampoFormulario';
import { enviarOSolicitarEnCola } from '../../servicios/sinConexion';
import { calculateBagGroupsKg, tonnes } from '../../servicios/presentacionCarga';
import { styles } from './SolicitarRecoleccion.styles';
import { validatePickupRequest } from '../../servicios/validacionSolicitud';

const emptyGroup = () => ({ id: Crypto.randomUUID(), peso_bulto_kg: '', cantidad_bultos: '' });

export default function SolicitarRecoleccion({ go, token }) {
  const [groups, setGroups] = useState([emptyGroup()]);
  const [obs, setObs] = useState('');
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [submitting, setSubmitting] = useState(false);
  const attemptIdRef = useRef(null);
  const submittingRef = useRef(false);
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const normalizedGroups = groups.map(({ peso_bulto_kg, cantidad_bultos }) => ({ peso_bulto_kg: Number(peso_bulto_kg), cantidad_bultos: Number(cantidad_bultos) }));
  const totalKg = calculateBagGroupsKg(normalizedGroups);
  const updateGroup = (id, field, value) => {
    attemptIdRef.current = null;
    setGroups((current) => current.map((group) => group.id === id ? { ...group, [field]: value } : group));
  };
  const removeGroup = (id) => {
    attemptIdRef.current = null;
    setGroups((current) => current.length > 1 ? current.filter((group) => group.id !== id) : current);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    try {
      const validationError = validatePickupRequest(normalizedGroups, obs);
      if (validationError || totalKg === null) throw Error(validationError || 'Completa el peso y la cantidad entera de cada grupo de bultos.');
      submittingRef.current = true;
      setSubmitting(true);
      attemptIdRef.current ||= Crypto.randomUUID();
      const result = await enviarOSolicitarEnCola('solicitud', { client_request_id: attemptIdRef.current, grupos_bultos: normalizedGroups, observacion: obs.trim(), fecha: new Date().toISOString() }, token);
      setMessage(result.offline ? 'Sin conexión: la solicitud quedó guardada y se enviará automáticamente.' : `Solicitud enviada correctamente. Peso total: ${totalKg.toLocaleString('es-CO')} kg · ${tonnes(totalKg)}.`, result.offline ? 'warning' : 'success');
      attemptIdRef.current = null;
      setGroups([emptyGroup()]);
      setObs('');
    } catch (reason) { setMessage(reason.message); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };

  return <ScrollView contentContainerStyle={styles.page}><View style={styles.content}>
    <Text style={styles.title}>Solicitar recolección</Text>
    <Text style={styles.muted}>Agrupa los bultos que tengan el mismo peso. Puedes agregar todos los grupos diferentes que necesites.</Text>
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>1. Confirma el punto de recogida</Text>
      <Text style={styles.muted}>Revisa que la ubicación de tu finca sea correcta. Será el punto al que llegará el conductor para recoger tu café.</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={() => go('farmLocation')}><Text style={styles.secondaryText}>Revisar ubicación de mi finca</Text></TouchableOpacity>
    </View>
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>2. Describe tu carga</Text>
      <Text style={styles.muted}>Por ejemplo: 10 bultos de 50 kg. Si tienes bultos de otro peso, agrega un nuevo grupo.</Text>
      {groups.map((group, index) => <View key={group.id} style={styles.bagGroup}>
        <Text style={styles.cardTitle}>Grupo {index + 1}</Text>
        <View style={styles.formRow}>
          <CampoFormulario label="Peso por bulto (kg)" value={group.peso_bulto_kg} onChangeText={(value) => updateGroup(group.id, 'peso_bulto_kg', value.replace(/[^0-9.,]/g, '').replace(',', '.'))} styles={styles} keyboardType="decimal-pad" />
          <CampoFormulario label="Cantidad de bultos" value={group.cantidad_bultos} onChangeText={(value) => updateGroup(group.id, 'cantidad_bultos', value.replace(/\D/g, ''))} styles={styles} keyboardType="number-pad" />
        </View>
        {groups.length > 1 ? <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={() => removeGroup(group.id)}><Text style={styles.removeLink}>Quitar este grupo</Text></TouchableOpacity> : null}
      </View>)}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: submitting }} disabled={submitting} style={styles.secondary} onPress={() => { attemptIdRef.current = null; setGroups((current) => [...current, emptyGroup()]); }}><Text style={styles.secondaryText}>＋ Agregar bultos de otro peso</Text></TouchableOpacity>
      <CampoFormulario label="Observaciones (opcional)" value={obs} onChangeText={(value) => { attemptIdRef.current = null; setObs(value); }} styles={styles} maxLength={100} />
      {totalKg !== null ? <View style={styles.totalBox}><Text style={styles.totalLabel}>Peso total calculado</Text><Text style={styles.totalValue}>{totalKg.toLocaleString('es-CO')} kg · {tonnes(totalKg)}</Text></View> : null}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting} style={[styles.primary, submitting && styles.buttonDisabled]} onPress={submit}><Text style={styles.primaryText}>{submitting ? 'Enviando solicitud…' : 'Enviar solicitud'}</Text></TouchableOpacity>
    </View>
    <FeedbackMessage type={messageType}>{message}</FeedbackMessage>
  </View></ScrollView>;
}
