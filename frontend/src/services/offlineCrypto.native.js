import { gcm } from '@noble/ciphers/aes.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'coffee-fly.offline.aes-key.v1';
const PREFIX = 'enc:v1:';
let keyPromise;

async function loadOrCreateKey() {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return hexToBytes(existing);
  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(KEY_NAME, bytesToHex(key), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}

async function encryptionKey() {
  if (!keyPromise) keyPromise = loadOrCreateKey().catch((error) => {
    keyPromise = null;
    throw error;
  });
  return keyPromise;
}

export function isEncryptedOfflineText(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptWithKey(plaintext, key, nonce) {
  if (key.length !== 32) throw new Error('La clave offline debe tener 256 bits');
  if (nonce.length !== 12) throw new Error('El nonce AES-GCM debe tener 96 bits');
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return `${PREFIX}${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
}

export function decryptWithKey(value, key) {
  if (!isEncryptedOfflineText(value)) return value;
  const parts = value.split(':');
  if (parts.length !== 4 || !parts[2] || !parts[3]) {
    throw new Error('Registro offline cifrado con formato inválido');
  }
  const plaintext = gcm(key, hexToBytes(parts[2])).decrypt(hexToBytes(parts[3]));
  return bytesToUtf8(plaintext);
}

export async function encryptOfflineText(plaintext) {
  const [key, nonce] = await Promise.all([
    encryptionKey(),
    Crypto.getRandomBytesAsync(12),
  ]);
  return encryptWithKey(plaintext, key, nonce);
}

export async function decryptOfflineText(value) {
  if (!isEncryptedOfflineText(value)) return value;
  return decryptWithKey(value, await encryptionKey());
}

export async function ensureEncryptedOfflineText(value) {
  return isEncryptedOfflineText(value) ? value : encryptOfflineText(value);
}
