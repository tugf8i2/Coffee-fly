import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_KEY = 'coffee_fly.device_id';

export async function deviceLoginInfo() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!deviceId) {
    deviceId = Array.from(Crypto.getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
  }
  return {
    device_id: deviceId,
    device_name: String(Platform.constants?.Model || Platform.constants?.systemName || 'Dispositivo móvil'),
    platform: Platform.OS,
  };
}
