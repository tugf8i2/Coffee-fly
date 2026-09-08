import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import CampoFormulario from '../../componentes/comunes/CampoFormulario';
import FondoCafeAnimado from '../../componentes/comunes/FondoCafeAnimado';
import { API_BASE_URL, fetchApi } from '../../configuracion/ClienteApi';
import { styles } from './IniciarSesion.styles';

export default function IniciarSesion({ onLogin }) {
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
  return <View style={[styles.page, styles.loginPage]}>
    <FondoCafeAnimado />
    <View style={[styles.formCard, styles.loginCard]}>
    <Text style={styles.loginEyebrow}>Gestión cafetera</Text>
    <Text style={styles.title}>Bienvenido a Coffee Fly</Text>
    <Text style={styles.loginDescription}>Ingresa para consultar y gestionar tu operación en Coffee Fly.</Text>
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
      maxLength={20}
      styles={styles}
      textContentType="password"
      onSubmitEditing={submit}
    />
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
    <TouchableOpacity style={[styles.primary, loading && styles.loading]} onPress={submit} disabled={loading}>
      <Text style={styles.primaryText}>{loading ? 'Iniciando sesión…' : 'Iniciar sesión'}</Text>
    </TouchableOpacity>
    <Text style={styles.loginHelp}>Usa el correo asignado a tu cuenta.</Text>
    </View>
  </View>;
}
