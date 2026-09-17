import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import usarAvisoConexion from '../../ganchos/usarAvisoConexion';

export default function AvisoConexion({ status, children }) {
  const targetRef = useRef(null);
  const notice = usarAvisoConexion(status);
  return <View style={styles.root}>
    <BlurTargetView ref={targetRef} style={styles.root}>{children}</BlurTargetView>
    {notice && <View style={styles.overlay} accessibilityViewIsModal>
      <BlurView blurTarget={targetRef} blurMethod="dimezisBlurView" intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.card} accessibilityLiveRegion="assertive">
        <Text style={styles.symbol}>{notice.kind === 'offline' ? '◌' : '✓'}</Text>
        <Text style={styles.title}>{notice.kind === 'offline' ? 'Modo sin conexión activado' : 'Conexión restablecida'}</Text>
        <Text style={styles.description}>{notice.kind === 'offline'
          ? 'El GPS y los datos compatibles se guardan en este dispositivo para sincronizarlos al volver la conexión.'
          : 'Estamos sincronizando los datos pendientes automáticamente.'}</Text>
        <Text style={styles.countdown}>Este aviso se cierra en {notice.seconds} s</Text>
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, alignItems: 'center', justifyContent: 'center', backgroundColor: '#061e13a6', padding: 20 },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 28, borderRadius: 22, backgroundColor: '#f9fff3', borderWidth: 2, borderColor: '#a9d17e', gap: 13, elevation: 15 },
  symbol: { color: '#075441', fontSize: 48, fontWeight: '700' },
  title: { color: '#123c2c', fontSize: 25, fontWeight: '800', textAlign: 'center' },
  description: { color: '#3b5645', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  countdown: { color: '#075441', fontSize: 15, fontWeight: '700', marginTop: 5 },
});
