// La sesión web permanece solamente durante la pestaña actual. No se persiste
// el token en localStorage para reducir su exposición ante scripts inyectados.
let currentSession = null;
let activeTracking = null;

export async function saveAuthenticatedSession(user, token) {
  currentSession = { user, token, savedAt: new Date().toISOString() };
}

export async function getAuthenticatedSession() {
  return currentSession;
}

export async function clearAuthenticatedSession() {
  currentSession = null;
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
