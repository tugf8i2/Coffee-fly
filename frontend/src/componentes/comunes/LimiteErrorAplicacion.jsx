import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // El detalle técnico queda disponible para el registro de desarrollo sin
    // mostrar tokens, credenciales ni datos GPS al usuario.
    console.error('Coffee Fly UI error', { message: error.message, componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { styles } = this.props;
    return <View style={styles.page}>
      <Text style={styles.title}>No pudimos mostrar este módulo</Text>
      <Text style={styles.error}>Ocurrió un error inesperado en la interfaz. Tus datos offline permanecen guardados.</Text>
      <TouchableOpacity style={styles.primary} onPress={this.reset}>
        <Text style={styles.primaryText}>Volver al panel</Text>
      </TouchableOpacity>
    </View>;
  }
}
