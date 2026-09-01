import * as SecureStore from 'expo-secure-store';

const AUTH_SESSION_KEY = 'coffee_fly.auth_session';
const ACTIVE_TRACKING_KEY = 'coffee_fly.active_tracking';
const secureOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

async function readJson(key) {
  try {
    const value = await SecureStore.getItemAsync(key, secureOptions);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function saveAuthenticatedSession(user, token) {
  await SecureStore.setItemAsync(
    AUTH_SESSION_KEY,
    JSON.stringify({ user, token, savedAt: new Date().toISOString() }),
    secureOptions,
  );
}

export function getAuthenticatedSession() {
  return readJson(AUTH_SESSION_KEY);
}

export async function clearAuthenticatedSession() {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY, secureOptions);
}

export async function saveActiveTracking(deliveryId) {
  await SecureStore.setItemAsync(
    ACTIVE_TRACKING_KEY,
    JSON.stringify({ deliveryId, startedAt: new Date().toISOString() }),
    secureOptions,
  );
}

export function getActiveTracking() {
  return readJson(ACTIVE_TRACKING_KEY);
}

export async function clearActiveTracking() {
  await SecureStore.deleteItemAsync(ACTIVE_TRACKING_KEY, secureOptions);
}
