import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { createGpsPoint, evaluateGpsPoint } from './gpsQuality';
import { trackingIntervals } from './backgroundPolicy';
import {
  guardarEstadoRastreo,
  obtenerEstadoSincronizacion,
  obtenerUltimoPuntoGps,
  registrarPuntoGpsOfflineFirst,
  sincronizarPendientes,
} from './offline';
import {
  clearActiveTracking,
  getActiveTracking,
  getAuthenticatedSession,
  saveActiveTracking,
} from './trackingSession';

export const BACKGROUND_LOCATION_TASK = 'coffee-fly-background-location';
let foregroundSubscription = null;
let foregroundChain = Promise.resolve();

async function trackingOptions() {
  let power = { batteryLevel: -1, lowPowerMode: false };
  try {
    power = await Battery.getPowerStateAsync();
  } catch {
    // Algunos emuladores no exponen datos de batería; se usa el perfil normal.
  }
  const profile = trackingIntervals(power);
  return {
    power,
    options: {
      accuracy: profile.conserving ? Location.Accuracy.Balanced : Location.Accuracy.High,
      timeInterval: profile.timeInterval,
      distanceInterval: profile.distanceInterval,
      deferredUpdatesDistance: profile.deferredUpdatesDistance,
      deferredUpdatesInterval: profile.deferredUpdatesInterval,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Coffee Fly · viaje en seguimiento',
        notificationBody: 'La ubicación se registra para la entrega activa.',
        notificationColor: '#386641',
        killServiceOnDestroy: false,
      },
    },
  };
}

export async function procesarLecturaGps(
  deliveryId,
  position,
  token,
  { force = false, historical = false, synchronizeNow = true } = {},
) {
  const point = createGpsPoint(position);
  const previous = await obtenerUltimoPuntoGps(deliveryId);
  const quality = evaluateGpsPoint(point, previous, {
    force,
    maxAgeMs: historical ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
  });
  if (!quality.valid || !quality.shouldStore) {
    await guardarEstadoRastreo({
      modo: 'capturando',
      ultimaLecturaEn: point.capturada_en,
      ultimoResultado: quality.valid ? 'omitida' : 'descartada',
      detalle: quality.reason,
    });
    return { accepted: false, quality };
  }
  const synchronization = await registrarPuntoGpsOfflineFirst(
    { entrega_id: deliveryId, ...point },
    token,
    { synchronizeNow },
  );
  await guardarEstadoRastreo({
    modo: 'capturando',
    ultimaLecturaEn: point.capturada_en,
    ultimoResultado: synchronization.offline ? 'guardada_local' : 'sincronizada',
    precisionM: point.precision_m,
  });
  return { accepted: true, point, quality, synchronization };
}

async function processBackgroundLocations(locations) {
  const tracking = await getActiveTracking();
  if (!tracking?.deliveryId) {
    await guardarEstadoRastreo({ modo: 'detenido', detalle: 'No existe un viaje activo.' });
    return;
  }
  const session = await getAuthenticatedSession();
  const ordered = [...(locations || [])].sort((first, second) => first.timestamp - second.timestamp);
  for (const location of ordered) {
    await procesarLecturaGps(tracking.deliveryId, location, session?.token, {
      historical: true,
      synchronizeNow: false,
    });
  }
  if (session?.token && ordered.length) await sincronizarPendientes(session.token);
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      await guardarEstadoRastreo({ modo: 'error', detalle: error.message });
      return;
    }
    try {
      await processBackgroundLocations(data?.locations || []);
    } catch (reason) {
      await guardarEstadoRastreo({ modo: 'error', detalle: reason.message || 'Error desconocido en tarea GPS.' });
    }
  });
}

async function startForegroundFallback(deliveryId, token) {
  foregroundSubscription?.remove();
  const profile = await trackingOptions();
  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: profile.options.accuracy,
      timeInterval: profile.options.timeInterval,
      distanceInterval: profile.options.distanceInterval,
    },
    (position) => {
      foregroundChain = foregroundChain
        .then(async () => {
          const latestSession = await getAuthenticatedSession();
          return procesarLecturaGps(deliveryId, position, latestSession?.token || token);
        })
        .catch((error) => guardarEstadoRastreo({ modo: 'error', detalle: error.message }));
    },
  );
  await guardarEstadoRastreo({ modo: 'primer_plano', entregaId: deliveryId });
}

export async function iniciarRastreoSegundoPlano(
  deliveryId,
  token,
  { requestBackground = true } = {},
) {
  const taskManagerAvailable = await TaskManager.isAvailableAsync();
  const locationAvailable = await Location.isBackgroundLocationAvailableAsync();
  if (!taskManagerAvailable || !locationAvailable) {
    await saveActiveTracking(deliveryId);
    await startForegroundFallback(deliveryId, token);
    return {
      background: false,
      reason: 'development_build_required',
      message: 'Expo Go no ejecuta esta tarea en segundo plano. Se mantendrá el GPS mientras la app esté abierta.',
    };
  }

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    await clearActiveTracking();
    return { background: false, reason: 'foreground_permission', message: 'Falta el permiso de ubicación en uso.' };
  }
  if (!requestBackground) {
    await saveActiveTracking(deliveryId);
    await startForegroundFallback(deliveryId, token);
    return {
      background: false,
      reason: 'background_permission_deferred',
      message: 'El GPS seguirá activo mientras Coffee Fly permanezca abierta.',
    };
  }
  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (backgroundPermission.status !== 'granted') {
    await saveActiveTracking(deliveryId);
    await startForegroundFallback(deliveryId, token);
    return {
      background: false,
      reason: 'background_permission',
      message: 'No se autorizó la ubicación permanente. El seguimiento funcionará solamente con la app abierta.',
    };
  }

  const profile = await trackingOptions();
  foregroundSubscription?.remove();
  foregroundSubscription = null;
  await saveActiveTracking(deliveryId);
  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, profile.options);
  } catch (error) {
    await startForegroundFallback(deliveryId, token);
    return {
      background: false,
      reason: 'background_start_failed',
      message: `No se pudo iniciar el servicio en segundo plano. El GPS continuará con la app abierta: ${error.message}`,
    };
  }
  let batteryOptimization = false;
  if (Platform.OS === 'android') {
    try {
      batteryOptimization = await Battery.isBatteryOptimizationEnabledAsync();
    } catch {
      // No todos los fabricantes exponen esta consulta.
    }
  }
  await guardarEstadoRastreo({
    modo: 'segundo_plano',
    entregaId: deliveryId,
    bateria: profile.power.batteryLevel,
    ahorroEnergia: profile.power.lowPowerMode,
    optimizacionBateria: batteryOptimization,
  });
  return {
    background: true,
    batteryOptimization,
    lowPowerMode: profile.power.lowPowerMode,
    batteryLevel: profile.power.batteryLevel,
  };
}

export async function detenerRastreoSegundoPlano() {
  try {
    foregroundSubscription?.remove();
    foregroundSubscription = null;
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Expo Go no expone el administrador de tareas. El observador foreground
    // ya fue retirado y la sesión local igualmente debe cerrarse.
  } finally {
    await clearActiveTracking();
    await guardarEstadoRastreo({ modo: 'detenido' });
  }
}

export async function obtenerEstadoGps() {
  const [tracking, synchronization, servicesEnabled, foreground, background] = await Promise.all([
    getActiveTracking(),
    obtenerEstadoSincronizacion(),
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  let taskStarted = false;
  try {
    taskStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    // Expo Go no permite consultar la tarea en todas las plataformas.
  }
  return {
    tracking,
    synchronization,
    servicesEnabled,
    foregroundPermission: foreground.status,
    backgroundPermission: background.status,
    taskStarted,
  };
}
