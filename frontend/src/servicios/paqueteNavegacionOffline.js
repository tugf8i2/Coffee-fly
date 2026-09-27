import { OFFLINE_MAP_STYLE_URL } from '../configuracion/mapaAbierto';
import { versionRuta } from './mapaSinConexionCalculos';

function routeBounds(points) {
  const valid = (points || []).filter((point) => Number.isFinite(Number(point?.latitude))
    && Number.isFinite(Number(point?.longitude)));
  if (!valid.length) return null;
  const latitudes = valid.map((point) => Number(point.latitude));
  const longitudes = valid.map((point) => Number(point.longitude));
  return {
    west: Math.min(...longitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
  };
}

export function createOfflineNavigationPackage({
  route,
  tripId = null,
  deliveryId,
  stage,
  origin,
  destination,
  waypoints = [],
  routeKey = `${deliveryId}:${stage}`,
}) {
  const geometry = Array.isArray(route?.puntos) ? route.puntos : [];
  const steps = Array.isArray(route?.instrucciones) ? route.instrucciones : [];
  const version = versionRuta(geometry);
  const createdAt = new Date().toISOString();
  return {
    ...route,
    entrega_id: deliveryId,
    etapa: route?.etapa || stage,
    calculada_en: Date.now(),
    tripId,
    origin,
    destination,
    waypoints,
    routeGeometry: geometry,
    routeSteps: steps,
    routeDistance: Number(route?.distancia_m || 0),
    routeDuration: Number(route?.duracion_s || 0),
    mapBounds: routeBounds(geometry),
    mapPackage: {
      routeKey,
      status: 'not_downloaded',
      version,
    },
    mapStyle: OFFLINE_MAP_STYLE_URL || null,
    navigationMetadata: {
      routeId: route?.routeId || `${tripId || deliveryId}:${stage}:${version}`,
      createdAt,
      version,
      provider: route?.proveedor || null,
    },
  };
}

export function attachOfflineMapPackage(navigationPackage, mapState) {
  if (!navigationPackage) return navigationPackage;
  return {
    ...navigationPackage,
    mapPackage: {
      ...(navigationPackage.mapPackage || {}),
      status: mapState?.listo ? 'ready' : 'incomplete',
      version: mapState?.routeVersion || navigationPackage.navigationMetadata?.version || null,
      downloadDate: mapState?.listo ? new Date().toISOString() : null,
      size: Number(mapState?.bytes || mapState?.bytesEstimados || 0),
      packs: Number(mapState?.paquetes || 0),
      resources: Number(mapState?.recursos || 0),
    },
  };
}
