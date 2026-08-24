import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import CampoFormulario from '../components/CampoFormulario';
import { API_BASE_URL } from '../config/Api';

export default function IniciarSesion({ onLogin, styles }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async () => { try { const response = await fetch(`${API_BASE_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const data = await response.json(); if (!response.ok) throw Error(data.detail || 'No se pudo iniciar sesión'); onLogin(data.user, data.access_token); } catch (reason) { setError(reason.message); } };
  return <View style={styles.page}><Text style={styles.title}>Bienvenido</Text><CampoFormulario label="Correo electrónico" value={email} onChangeText={setEmail} styles={styles} /><CampoFormulario label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry styles={styles} /><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.primary} onPress={submit}><Text style={styles.primaryText}>Iniciar sesión</Text></TouchableOpacity></View>;
}
