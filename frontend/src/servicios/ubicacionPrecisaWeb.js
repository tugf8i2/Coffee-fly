// La primera respuesta puede ser una estimación de red. Esperar nuevas
// lecturas permite al dispositivo mejorar la posición sin inventar precisión.
export function buscarUbicacionPrecisa(geolocation, { onProgress, onSuccess, onError, timeoutMs = 25000 } = {}) {
  let finished = false;
  let watchId;
  let best = null;
  const startedAt = Date.now();
  const stop = () => {
    finished = true;
    clearTimeout(timer);
    if (watchId != null) geolocation.clearWatch(watchId);
  };
  const finish = () => {
    stop();
    if (best && best.coords.accuracy <= 25) onSuccess(best);
    else onError(new Error(best
      ? `La mejor precisión fue ±${Math.round(best.coords.accuracy)} m. No se cambió el punto seleccionado. Prueba al aire libre con el celular o coloca el marcador manualmente.`
      : 'No se obtuvo una ubicación reciente. Revisa el permiso de ubicación o coloca el marcador manualmente.'));
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
      if (!best || accuracy < best.coords.accuracy) best = position;
      onProgress?.(`Mejorando ubicación: precisión estimada ±${Math.round(best.coords.accuracy)} m…`);
      if (best.coords.accuracy <= 10) finish();
    }, (error) => {
      if (finished || error.code !== 1) return;
      stop();
      onError(new Error('Autoriza la ubicación para seleccionar tu posición actual.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs });
    if (finished && watchId != null) geolocation.clearWatch(watchId);
  } catch (error) {
    stop();
    onError(error);
  }
  return stop;
}
