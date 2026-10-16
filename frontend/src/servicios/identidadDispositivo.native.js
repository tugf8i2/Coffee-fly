import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClientUuid } from './idCliente';

const DEVICE_ID_KEY = 'coffee_fly.device_id';

export async function identificarDispositivo() {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = createClientUuid();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return {
    device_id: id,
    device_name: Platform.OS === 'android' ? 'Android · Coffee Fly' : 'iPhone · Coffee Fly',
    device_platform: Platform.OS,
  };
}
