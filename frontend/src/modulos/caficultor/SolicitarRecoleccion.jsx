import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import CampoFormulario from '../../componentes/comunes/CampoFormulario';
import { enviarOSolicitarEnCola } from '../../servicios/sinConexion';
import { calculateBagGroupsKg, tonnes } from '../../servicios/presentacionCarga';
import { styles } from './SolicitarRecoleccion.styles';

const emptyGroup = () => ({ id: Crypto.randomUUID(), peso_bulto_kg: '', cantidad_bultos: '' });

export default function SolicitarRecoleccion({ go, token }) {
  const [groups, setGroups] = useState([emptyGroup()]);
  const [obs, setObs] = useState('');
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };
  const normalizedGroups = groups.map(({ peso_bulto_kg, cantidad_bultos }) => ({ peso_bulto_kg: Number(peso_bulto_kg), cantidad_bultos: Number(cantidad_bultos) }));
  const totalKg = calculateBagGroupsKg(normalizedGroups);
  const updateGroup = (id, field, value) => setGroups((current) => current.map((group) => group.id === id ? { ...group, [field]: value } : group));
  const removeGroup = (id) => setGroups((current) => current.length > 1 ? current.filter((group) => group.id !== id) : current);

  const submit = async () => {
    try {
      if (totalKg === null) throw Error('Completa el peso y la cantidad entera de cada grupo de bultos.');
      const result = await enviarOSolicitarEnCola('solicitud', { client_request_id: Crypto.randomUUID(), grupos_bultos: normalizedGroups, observacion: obs.trim(), fecha: new Date().toISOString() }, token);
      setMessage(result.offline ? 'Sin conexión: la solicitud quedó guardada y se enviará automáticamente.' : `Solicitud enviada correctamente. Peso total: ${totalKg.toLocaleString('es-CO')} kg · ${tonnes(totalKg)}.`, result.offline ? 'warning' : 'success');
      if (!result.offline) { setGroups([emptyGroup()]); setObs(''); }
    } catch (reason) { setMessage(reason.message); }
  };

  return <ScrollView contentContainerStyle={styles.page}><View style={styles.content}>
    <Text style={styles.title}>Solicitar recolección</Text>
    <Text style={styles.muted}>Agrupa los bultos que tengan el mismo peso. Puedes agregar todos los grupos diferentes que necesites.</Text>
    <View style={styles.formCard}>
      {groups.map((group, index) => <View key={group.id} style={styles.bagGroup}>
        <Text style={styles.cardTitle}>Grupo {index + 1}</Text>
        <View style={styles.formRow}>
          <CampoFormulario label="Peso por bulto (kg)" value={group.peso_bulto_kg} onChangeText={(value) => updateGroup(group.id, 'peso_bulto_kg', value.replace(/[^0-9.,]/g, '').replace(',', '.'))} styles={styles} keyboardType="decimal-pad" />
          <CampoFormulario label="Cantidad de bultos" value={group.cantidad_bultos} onChangeText={(value) => updateGroup(group.id, 'cantidad_bultos', value.replace(/\D/g, ''))} styles={styles} keyboardType="number-pad" />
        </View>
        {groups.length > 1 ? <TouchableOpacity onPress={() => removeGroup(group.id)}><Text style={styles.removeLink}>Quitar este grupo</Text></TouchableOpacity> : null}
      </View>)}
      <TouchableOpacity style={styles.secondary} onPress={() => setGroups((current) => [...current, emptyGroup()])}><Text style={styles.secondaryText}>＋ Agregar bultos de otro peso</Text></TouchableOpacity>
      <CampoFormulario label="Observaciones (opcional)" value={obs} onChangeText={setObs} styles={styles} maxLength={100} />
      {totalKg !== null ? <View style={styles.totalBox}><Text style={styles.totalLabel}>Peso total calculado</Text><Text style={styles.totalValue}>{totalKg.toLocaleString('es-CO')} kg · {tonnes(totalKg)}</Text></View> : null}
      <TouchableOpacity style={styles.primary} onPress={submit}><Text style={styles.primaryText}>Enviar solicitud</Text></TouchableOpacity>
    </View>
    <FeedbackMessage type={messageType}>{message}</FeedbackMessage>
  </View></ScrollView>;
}
