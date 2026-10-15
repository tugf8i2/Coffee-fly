// El navegador conserva el token solo en memoria. Dentro de la APK, el puente
// nativo lo guarda en SecureStore para restaurar la sesión tras reiniciar offline.
let currentSession = null;
let activeTracking = null;
let sessionLoaded = false;
let sessionLoadPromise = null;
let nextRequestId = 0;
const pendingRequests = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('coffee-fly:secure-session-result', (event) => {
    const { requestId, value, error } = event.detail || {};
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);
    clearTimeout(pending.timer);
    if (error) pending.reject(new Error(error));
    else pending.resolve(value ?? null);
  });
}

function nativeSession(action, value) {
  if (typeof window === 'undefined' || !window.__COFFEE_FLY_SECURE_SESSION_BRIDGE__ || !window.ReactNativeWebView?.postMessage) return Promise.resolve(null);
  const requestId = `session-${++nextRequestId}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('No respondió el almacenamiento seguro del dispositivo.'));
    }, 8000);
    pendingRequests.set(requestId, { resolve, reject, timer });
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'secure_session', action, requestId, value }));
  });
}

export async function saveAuthenticatedSession(user, token) {
  const { foto_perfil: _fotoPerfil, ...sessionUser } = user;
  currentSession = { user: sessionUser, token, savedAt: new Date().toISOString() };
  sessionLoaded = true;
  await nativeSession('set', currentSession);
}

export async function getAuthenticatedSession() {
  if (!sessionLoaded) {
    if (!sessionLoadPromise) {
      sessionLoadPromise = nativeSession('get').then((stored) => {
        if (!sessionLoaded) currentSession = stored;
      }).catch(() => {
        // La app aún puede iniciar sesión online si SecureStore está indisponible.
      }).finally(() => { sessionLoaded = true; sessionLoadPromise = null; });
    }
    await sessionLoadPromise;
  }
  return currentSession;
}

export async function clearAuthenticatedSession() {
  currentSession = null;
  sessionLoaded = true;
  await nativeSession('delete');
}

export async function saveActiveTracking(deliveryId) {
  activeTracking = { deliveryId, startedAt: new Date().toISOString() };
}

export async function getActiveTracking() {
  return activeTracking;
}

export async function clearActiveTracking() {
  activeTracking = null;
}
