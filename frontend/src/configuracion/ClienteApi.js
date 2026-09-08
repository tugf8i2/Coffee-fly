import { Platform } from 'react-native';
import Constants from 'expo-constants';

function normalizeBaseUrl(value) {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  return normalized || null;
}

export function resolveApiBaseUrl(configuredUrl, platform = Platform.OS, hostUri = Constants.expoConfig?.hostUri) {
  const configured = normalizeBaseUrl(configuredUrl);
  if (configured) return configured;
  if (platform === 'web') return '/api';
  if (hostUri) {
    try {
      const metroUrl = new URL(String(hostUri).includes('://') ? hostUri : `http://${hostUri}`);
      const hostname = metroUrl.hostname;
      // En modo LAN Metro publica la IP real del computador. Los dominios de
      // túnel no exponen FastAPI en el puerto 8000; el script de túnel inyecta
      // una EXPO_PUBLIC_API_URL HTTPS para esos casos.
      if (hostname && !/(exp\.direct|expo\.dev|ngrok|trycloudflare\.com)$/i.test(hostname)) {
        const displayedHost = hostname.includes(':') ? `[${hostname}]` : hostname;
        return `http://${displayedHost}:8000`;
      }
    } catch {
      // Si Expo no entrega un host utilizable, se conserva el fallback del emulador.
    }
  }
  return 'http://10.0.2.2:8000';
}

// En el export web, /api usa el mismo host que sirvió la aplicación y Nginx
// lo redirige al backend. Así el paquete no queda atado a localhost ni a la
// IP de la red donde fue compilado. En una app nativa la URL debe ser absoluta.
export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);

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

function isSafeToRetry(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

function isTransientStatus(status) {
  return [408, 425, 429, 502, 503, 504].includes(status);
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function fetchApi(input, options = {}) {
  const {
    timeoutMs = 15000,
    retries = 2,
    retryDelayMs = 350,
    signal: callerSignal,
    ...fetchOptions
  } = options;
  const maximumAttempts = isSafeToRetry(fetchOptions.method) ? Math.max(1, Number(retries) + 1) : 1;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(input, { ...fetchOptions, signal: controller.signal });
      if (isTransientStatus(response.status) && attempt < maximumAttempts) {
        await wait(retryDelayMs * attempt);
        continue;
      }
      if (response.status === 401 && hasAuthorization(fetchOptions.headers)) {
        sessionExpiredListeners.forEach((listener) => listener());
      }
      return response;
    } catch (error) {
      if (callerSignal?.aborted) throw new Error('La solicitud fue cancelada.');
      if (timedOut) {
        throw new Error('La solicitud tardó demasiado. El servidor puede estar iniciando; espera unos segundos e inténtalo nuevamente.');
      }
      if (attempt < maximumAttempts) {
        await wait(retryDelayMs * attempt);
        continue;
      }
      const connectionError = new Error('No fue posible conectar con Coffee Fly. Tus datos offline se conservarán; revisa la red o el estado del servidor e intenta sincronizar nuevamente.');
      connectionError.code = 'API_UNREACHABLE';
      connectionError.retryable = true;
      connectionError.cause = error;
      throw connectionError;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener?.('abort', abortFromCaller);
    }
  }
  throw new Error('No fue posible completar la solicitud.');
}
