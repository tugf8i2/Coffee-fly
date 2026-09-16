import Storage from 'expo-sqlite/kv-store';
export const readDriverValue = (key) => Storage.getItem(key);
export const writeDriverValue = (key, value) => Storage.setItem(key, value);
