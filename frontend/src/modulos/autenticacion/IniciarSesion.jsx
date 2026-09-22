import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useState } from 'react';
import { Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import CampoFormulario from '../../componentes/comunes/CampoFormulario';
import { API_BASE_URL, fetchApi } from '../../configuracion/ClienteApi';
import { styles } from './IniciarSesion.styles';
import background from '../../assets/brand/coffee-landscape.jpg';
import panelBackground from '../../assets/brand/coffee-panel.jpg';
import logo from '../../assets/brand/login-logo.png';
import { accesoPermitidoEnPlataforma, MENSAJE_CONDUCTOR_SOLO_MOVIL } from '../../servicios/accesoPlataforma';

export default function IniciarSesion({ onLogin }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
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
      if (!accesoPermitidoEnPlataforma(data.user?.rol, Platform.OS)) {
        try {
          await fetchApi(`${API_BASE_URL}/logout`, {
            method: 'POST', headers: { Authorization: `Bearer ${data.access_token}` },
          });
        } catch { /* El acceso web permanece bloqueado aunque falle el cierre remoto. */ }
        throw Error(MENSAJE_CONDUCTOR_SOLO_MOVIL);
      }
      await onLogin(data.user, data.access_token);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  };
  const brand = <View style={styles.loginBrand}>
    <Image source={logo} style={styles.loginLogo} resizeMode="contain" />
    <Text style={styles.loginBrandName}>Coffee Fly</Text>
    <Text style={styles.loginSlogan}>Tu café viaja</Text>
  </View>;
  const motto = <View style={[styles.loginMotto, !desktop && styles.loginMottoMobile]}>
    <Text style={[styles.loginMottoText, !desktop && styles.loginMottoTextMobile]}>Del campo</Text>
    <Text style={[styles.loginMottoText, styles.loginMottoSecondLine, !desktop && styles.loginMottoTextMobile]}>a su destino</Text>
    <View style={styles.loginMottoUnderline} />
  </View>;

  return <KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.loginScroller} contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} alwaysBounceVertical>
      <View style={[styles.loginLayout, !desktop && styles.loginLayoutMobile]}>
        <ImageBackground source={desktop ? panelBackground : background} resizeMode="cover" style={[styles.loginVisual, !desktop && styles.loginVisualMobile]} imageStyle={[styles.loginVisualImage, desktop ? styles.loginVisualImageDesktop : styles.loginVisualImageMobile]}>
          <View style={styles.loginVisualShade} />
          {desktop ? <View style={styles.loginStory}>
            {brand}
            <View style={styles.loginStoryCopy}>
              <Text style={styles.loginStoryTitle}>Conectamos el campo con grandes destinos</Text>
              <Text style={styles.loginStoryBody}>Una plataforma que une a caficultores, cooperativas y transportadores para que el café llegue más lejos.</Text>
            </View>
            <View style={styles.loginBenefits}>
              <Text style={styles.loginBenefit}>●  Más oportunidades para el caficultor</Text>
              <Text style={styles.loginBenefit}>●  Transporte seguro y confiable</Text>
              <Text style={styles.loginBenefit}>●  Trazabilidad en tiempo real</Text>
              <Text style={styles.loginBenefit}>●  Un café colombiano para el mundo</Text>
            </View>
            {motto}
          </View> : motto}
        </ImageBackground>

        <View style={[styles.loginPanel, !desktop && styles.loginPanelMobile]}>
          <View style={[styles.loginCard, !desktop && styles.loginCardMobile]}>
            {brand}
            <Text style={styles.loginTitle}>Inicia sesión</Text>
            <Text style={styles.loginDescription}>Accede a tu cuenta</Text>
            <View style={styles.loginFields}>
              <CampoFormulario
                label="Correo electrónico"
                icon="✉"
                value={email}
                onChangeText={setEmail}
                styles={styles}
                placeholder="ej. usuario@coffeefly.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
              />
              <CampoFormulario
                label="Contraseña"
                icon="▢"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={20}
                styles={styles}
                placeholder="Ingresa tu contraseña"
                textContentType="password"
                onSubmitEditing={submit}
              />
            </View>
            {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} style={[styles.loginButton, loading && styles.loading]} onPress={submit} disabled={loading}>
              <Text style={styles.loginButtonText}>{loading ? 'Iniciando sesión…' : 'Iniciar sesión'}</Text>
              {!loading ? <Text style={styles.loginButtonArrow}>→</Text> : null}
            </TouchableOpacity>
            <Text style={styles.loginHelp}>Usa el correo asignado a tu cuenta.</Text>
          </View>
          <View style={styles.loginTrustRow}>
            <Text style={styles.loginTrust}>◇  Conexión segura</Text>
            <Text style={styles.loginTrust}>▣  Tus datos están protegidos</Text>
            <Text style={styles.loginTrust}>♧  Comprometidos con el café</Text>
          </View>
          <Text style={styles.loginCopyright}>Coffee Fly © 2026. Todos los derechos reservados.</Text>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
