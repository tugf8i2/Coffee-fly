import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import CampoFormulario from '../components/CampoFormulario';
import { enviarOSolicitarEnCola } from '../services/offline';

export default function SolicitarRecoleccion({ go, token, styles }) {
  const [kg, setKg] = useState(''); const [obs, setObs] = useState(''); const [message, setMessage] = useState('');
  const submit = async () => { try { const peso = Number(kg); if (!Number.isFinite(peso) || peso <= 0) throw Error('La cantidad de café debe ser mayor que cero.'); const result = await enviarOSolicitarEnCola('solicitud', { client_request_id: Crypto.randomUUID(), kg: peso, observacion: obs.trim(), fecha: new Date().toISOString() }, token); setMessage(result.offline ? 'Sin conexión: la solicitud quedó guardada en el dispositivo y se enviará automáticamente.' : 'Solicitud enviada correctamente.'); if (!result.offline) { setKg(''); setObs(''); } } catch (reason) { setMessage(reason.message); } };
  return <View style={styles.page}><Text style={styles.title}>Solicitar recolección</Text><Text style={styles.muted}>Puedes registrar la solicitud sin conexión; se guarda localmente hasta sincronizar.</Text><CampoFormulario label="Cantidad de café (kg)" value={kg} onChangeText={setKg} styles={styles} /><CampoFormulario label="Observaciones (opcional)" value={obs} onChangeText={setObs} styles={styles} /><Text style={styles.muted}>{message}</Text><TouchableOpacity style={styles.primary} onPress={submit}><Text style={styles.primaryText}>Enviar solicitud</Text></TouchableOpacity><TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver</Text></TouchableOpacity></View>;
}
