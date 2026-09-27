import React, { useCallback, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const APP_URL = String(process.env.EXPO_PUBLIC_APP_URL || 'https://coffee-fly.hostless.app')
  .trim()
  .replace(/\/+$/, '');

export default function EntradaAplicacion() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const reload = useCallback(() => {
    setFailed(false);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden animated />
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webView}
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        domStorageEnabled
        javaScriptEnabled
        geolocationEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        onLoadStart={() => setFailed(false)}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onError={() => setFailed(true)}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) setFailed(true);
        }}
      />
      {failed ? (
        <View style={styles.offline}>
          <Text style={styles.title}>Coffee Fly no pudo conectarse</Text>
          <Text style={styles.description}>
            Revisa la conexión a internet. La aplicación cargará siempre la versión más reciente del servidor.
          </Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={reload}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001c17' },
  webView: { flex: 1, backgroundColor: '#001c17' },
  offline: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#001c17',
  },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  description: { color: '#c9ddd8', fontSize: 16, lineHeight: 24, marginTop: 12, textAlign: 'center' },
  button: { backgroundColor: '#f4b942', borderRadius: 12, marginTop: 24, paddingHorizontal: 24, paddingVertical: 13 },
  buttonText: { color: '#001c17', fontSize: 16, fontWeight: '700' },
});
