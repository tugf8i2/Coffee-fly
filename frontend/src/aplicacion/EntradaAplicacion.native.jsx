import React, { useCallback, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { DeviceMotion } from 'expo-sensors';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

const APP_URL = String(process.env.EXPO_PUBLIC_APP_URL || 'https://coffee-fly.hostless.app')
  .trim()
  .replace(/\/+$/, '');

export default function EntradaAplicacion() {
  const webViewRef = useRef(null);
  const sensorSubscriptions = useRef([]);
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

  const stopSensors = useCallback(() => {
    sensorSubscriptions.current.forEach((subscription) => subscription?.remove?.());
    sensorSubscriptions.current = [];
  }, []);

  const sendSensor = useCallback((data) => {
    webViewRef.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('coffee-fly:navigation-sensors', { detail: ${JSON.stringify(data)} })); true;`);
  }, []);

  const pickImage = useCallback(async ({ requestId, camara, cuadrada }) => {
    let detail = { requestId };
    try {
      if (camara) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Autoriza la cámara para tomar la evidencia.');
      }
      const options = { mediaTypes: ['images'], allowsEditing: true, aspect: cuadrada ? [1, 1] : [4, 3], quality: 0.45, base64: true, exif: false };
      const result = camara ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        detail = { requestId, asset: { base64: asset.base64, mimeType: asset.mimeType } };
      }
    } catch (error) {
      detail = { requestId, error: error?.message || 'No fue posible abrir la cámara o las fotos.' };
    }
    webViewRef.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('coffee-fly:image-picker-result', { detail: ${JSON.stringify(detail)} })); true;`);
  }, []);

  const startSensors = useCallback(async () => {
    if (sensorSubscriptions.current.length) return;
    try {
      const permission = await DeviceMotion.requestPermissionsAsync();
      if (permission.granted && await DeviceMotion.isAvailableAsync()) {
        DeviceMotion.setUpdateInterval(200);
        sensorSubscriptions.current.push(DeviceMotion.addListener((measurement) => {
          sendSensor({ type: 'motion', gravity: measurement.accelerationIncludingGravity, rotationRate: measurement.rotationRate });
        }));
      }
    } catch { /* GPS heading remains available when motion permission fails. */ }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        sensorSubscriptions.current.push(await Location.watchPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        }, (position) => {
          sendSensor({ type: 'position', coords: position.coords, timestamp: position.timestamp });
        }));
        sensorSubscriptions.current.push(await Location.watchHeadingAsync((heading) => {
          sendSensor({ type: 'heading', heading: heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading, accuracy: heading.accuracy });
        }));
      }
    } catch { /* Location remains unavailable until the device grants permission. */ }
  }, [sendSensor]);

  React.useEffect(() => stopSensors, [stopSensors]);

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
        onMessage={(event) => {
          if (event.nativeEvent.data === 'navigation_sensors_start') startSensors();
          if (event.nativeEvent.data === 'navigation_sensors_stop') stopSensors();
          if (event.nativeEvent.data?.startsWith('{')) {
            try {
              const request = JSON.parse(event.nativeEvent.data);
              if (request.type === 'image_picker' && request.requestId) pickImage(request);
            } catch { /* Ignore unrelated WebView messages. */ }
          }
        }}
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
