import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import CampoFormulario from '../components/CampoFormulario';
import { API_BASE_URL, fetchApi } from '../config/Api';

export default function IniciarSesion({ onLogin, styles }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Escribe tu correo y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo iniciar sesión');
      await onLogin(data.user, data.access_token);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  };
  return <View style={styles.page}>
    <Text style={styles.title}>Bienvenido</Text>
    <CampoFormulario
      label="Correo electrónico"
      value={email}
      onChangeText={setEmail}
      styles={styles}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="username"
    />
    <CampoFormulario
      label="Contraseña"
      value={password}
      onChangeText={setPassword}
      secureTextEntry
      styles={styles}
      textContentType="password"
      onSubmitEditing={submit}
    />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <TouchableOpacity style={[styles.primary, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
      <Text style={styles.primaryText}>{loading ? 'Iniciando sesión…' : 'Iniciar sesión'}</Text>
    </TouchableOpacity>
  </View>;
}
