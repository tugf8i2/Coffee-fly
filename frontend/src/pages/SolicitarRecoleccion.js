import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import CampoFormulario from '../components/CampoFormulario';
import { API_BASE_URL } from '../config/Api';

export default function SolicitarRecoleccion({ go, token, styles }) {
  const [kg, setKg] = useState(''); const [obs, setObs] = useState(''); const [message, setMessage] = useState('');
  const submit = async () => { try { const carga = await fetch(`${API_BASE_URL}/cargas/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ peso_kg: Number(kg), descripcion: obs }) }); const c = await carga.json(); if (!carga.ok) throw Error(c.detail || 'No se pudo crear carga'); const response = await fetch(`${API_BASE_URL}/solicitudes/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ estado_solicitud: 'pendiente', fecha_hora_solicitud: new Date().toISOString(), carga_id: c.id_carga }) }); if (!response.ok) throw Error('No se pudo crear solicitud'); setMessage('Solicitud enviada correctamente'); } catch (reason) { setMessage(reason.message); } };
  return <View style={styles.page}><Text style={styles.title}>Solicitar recolección</Text><CampoFormulario label="Cantidad de café (kg)" value={kg} onChangeText={setKg} styles={styles} /><CampoFormulario label="Observaciones" value={obs} onChangeText={setObs} styles={styles} /><Text style={styles.muted}>{message}</Text><TouchableOpacity style={styles.primary} onPress={submit}><Text style={styles.primaryText}>Enviar solicitud</Text></TouchableOpacity><TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver</Text></TouchableOpacity></View>;
}
