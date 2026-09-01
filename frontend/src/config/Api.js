import { Platform } from 'react-native';

// Para un teléfono físico, usa la IP del PC en la misma red Wi-Fi.
// Para Android Emulator, usa: http://10.0.2.2:8000
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL
  || (Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000');

const sessionExpiredListeners = new Set();

export function subscribeSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function hasAuthorization(headers) {
  try {
    return new Headers(headers || {}).has('Authorization');
  } catch {
    return Boolean(headers?.Authorization || headers?.authorization);
  }
}

export async function fetchApi(input, options = {}) {
  const { timeoutMs = 15000, signal: callerSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...fetchOptions, signal: controller.signal });
    if (response.status === 401 && hasAuthorization(fetchOptions.headers)) {
      sessionExpiredListeners.forEach((listener) => listener());
    }
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión e inténtalo nuevamente.');
    }
    throw new Error('No fue posible conectar con Coffee Fly. Revisa Internet o intenta nuevamente.');
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener?.('abort', abortFromCaller);
  }
}
