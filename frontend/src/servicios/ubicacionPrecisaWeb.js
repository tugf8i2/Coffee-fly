// La primera respuesta puede ser una estimación de red. Esperar nuevas
// lecturas permite al dispositivo mejorar la posición sin inventar precisión.
export function buscarUbicacionPrecisa(geolocation, { onProgress, onSuccess, onError, timeoutMs = 25000 } = {}) {
  let finished = false;
  let watchId;
  let best = null;
  let settleTimer;
  const startedAt = Date.now();
  const stop = () => {
    finished = true;
    clearTimeout(timer);
    clearTimeout(settleTimer);
    if (watchId != null) geolocation.clearWatch(watchId);
  };
  const finish = () => {
    stop();
    if (best) onSuccess(best);
    else onError(new Error('No se obtuvo una ubicación reciente. Revisa el permiso de ubicación o coloca el marcador manualmente.'));
  };
  const timer = setTimeout(finish, timeoutMs);
  try {
    watchId = geolocation.watchPosition((position) => {
      if (finished) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
        || !Number.isFinite(longitude) || Math.abs(longitude) > 180
        || !Number.isFinite(accuracy) || accuracy < 0
        || !Number.isFinite(position.timestamp) || position.timestamp < startedAt - 5000
        || position.timestamp > Date.now() + 5000) return;
      if (!best || accuracy < best.coords.accuracy) {
        best = position;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(finish, 6000);
      }
      onProgress?.(`Mejorando ubicación: precisión estimada ±${Math.round(best.coords.accuracy)} m…`);
      if (best.coords.accuracy <= 10) finish();
    }, (error) => {
      if (finished) return;
      stop();
      const messages = {
        1: 'El navegador tiene bloqueado el permiso de ubicación. Pulsa el candado o el icono de permisos junto a la dirección, permite «Ubicación» para este sitio y vuelve a intentarlo. También puedes elegir el punto directamente en el mapa.',
        2: 'El navegador no pudo determinar tu ubicación. Activa la ubicación del dispositivo, comprueba la conexión y vuelve a intentarlo; también puedes elegir el punto en el mapa.',
        3: 'La ubicación tardó demasiado en responder. Acércate a una ventana o usa el mapa para seleccionar el punto manualmente.',
      };
      onError(new Error(messages[error.code] || 'No fue posible obtener la ubicación actual. Selecciona el punto manualmente en el mapa.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs });
    if (finished && watchId != null) geolocation.clearWatch(watchId);
  } catch (error) {
    stop();
    onError(error);
  }
  return stop;
}

export async function validarAccesoUbicacionWeb(environment = globalThis) {
  const host = environment.location?.hostname;
  if (environment.isSecureContext === false && !['localhost', '127.0.0.1'].includes(host)) {
    throw Error('La ubicación del navegador requiere una conexión HTTPS segura. Abre Coffee Fly mediante HTTPS o selecciona el punto directamente en el mapa.');
  }
  if (!environment.navigator?.geolocation) {
    throw Error('Este navegador no ofrece acceso a la ubicación. Escribe las coordenadas o selecciona el punto directamente en el mapa.');
  }
  try {
    const permission = await environment.navigator.permissions?.query?.({ name: 'geolocation' });
    if (permission?.state === 'denied') {
      throw Error('El permiso de ubicación está bloqueado para Coffee Fly. Pulsa el candado o el icono de permisos junto a la dirección, cambia «Ubicación» a «Permitir» y vuelve a intentarlo.');
    }
  } catch (error) {
    if (/bloqueado para Coffee Fly/.test(error.message)) throw error;
    // Algunos navegadores no implementan Permissions API; geolocation aún puede solicitar permiso.
  }
  return environment.navigator.geolocation;
}
