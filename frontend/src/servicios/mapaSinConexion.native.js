import { RUNNING_IN_EXPO_GO } from '../configuracion/mapasNativos';
import { Paths } from 'expo-file-system';
import {
  OFFLINE_MAP_CORRIDOR_KM,
  OFFLINE_MAP_ESTIMATED_TILE_KB,
  OFFLINE_MAP_MAX_ZOOM,
  OFFLINE_MAP_MIN_FREE_MB,
  OFFLINE_MAP_MIN_ZOOM,
  OFFLINE_MAP_SEGMENT_KM,
  OFFLINE_MAP_STYLE_URL,
  OFFLINE_MAP_TILE_LIMIT,
} from '../configuracion/mapaAbierto';
import { offlineOwnerId } from './propietarioSinConexion';
import { getAuthenticatedSession } from './sesionSeguimiento';
import {
  estimarCantidadTiles,
  estimarTamanoDescargaBytes,
  limitesCorredor,
  segmentarCorredorRuta,
  versionRuta,
} from './mapaSinConexionCalculos';

const NAMESPACE = 'coffee-fly-offline-map-v1';
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const BYTES_PER_MB = 1024 * 1024;

function manager() {
  if (RUNNING_IN_EXPO_GO) throw new Error('Los mapas offline requieren una development build o APK; Expo Go no incluye MapLibre nativo.');
  try {
    return require('@maplibre/maplibre-react-native').OfflineManager;
  } catch {
    throw new Error('MapLibre nativo no esta disponible en esta compilacion.');
  }
}

async function ownerId() {
  return offlineOwnerId(await getAuthenticatedSession());
}

function metadataOf(pack) {
  if (!pack?.metadata) return {};
  if (typeof pack.metadata === 'string') {
    try { return JSON.parse(pack.metadata); } catch { return {}; }
  }
  return pack.metadata;
}

const isComplete = (status) => status?.state === 'complete' || Number(status?.percentage || 0) >= 100;

async function relevantPacks(routeKey, owner) {
  const packs = await manager().getPacks();
  return packs.filter((pack) => {
    const metadata = metadataOf(pack);
    return metadata.namespace === NAMESPACE
      && String(metadata.ownerId) === String(owner)
      && String(metadata.routeKey) === String(routeKey);
  });
}

export function mapaSinConexionConfigurado() {
  return Boolean(OFFLINE_MAP_STYLE_URL);
}

export async function obtenerEstadoMapaSinConexion(routeKey, route = null) {
  if (!OFFLINE_MAP_STYLE_URL) {
    return { disponible: false, listo: false, motivo: 'No hay un estilo cartografico configurado para preparar el mapa offline.' };
  }
  if (RUNNING_IN_EXPO_GO) {
    return { disponible: false, listo: false, motivo: 'Disponible solamente en una development build o APK.' };
  }
  const owner = await ownerId();
  if (!owner || !routeKey) return { disponible: true, listo: false, progreso: 0, paquetes: 0 };
  const expectedVersion = route?.length ? versionRuta(route) : null;
  const packs = (await relevantPacks(routeKey, owner)).filter((pack) => (
    !expectedVersion || metadataOf(pack).routeVersion === expectedVersion
  ));
  const groups = new Map();
  for (const pack of packs) {
    const metadata = metadataOf(pack);
    const key = String(metadata.routeVersion || 'legacy');
    const status = await pack.status();
    const group = groups.get(key) || { expected: Number(metadata.segmentCount || 1), items: [] };
    group.items.push({ pack, metadata, status });
    groups.set(key, group);
  }
  const candidates = [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  const complete = candidates.find((group) => group.items.length >= group.expected && group.items.every((item) => isComplete(item.status)));
  const selected = complete || candidates[0];
  if (!selected) return { disponible: true, listo: false, progreso: 0, paquetes: 0 };
  const progress = selected.items.reduce((sum, item) => sum + Number(item.status?.percentage || 0), 0) / selected.expected;
  return {
    disponible: true,
    listo: Boolean(complete),
    progreso: Math.min(100, Math.round(progress)),
    paquetes: selected.items.length,
    recursos: selected.items.reduce((sum, item) => sum + Number(item.status?.completedResourceCount || 0), 0),
    bytes: selected.items.reduce((sum, item) => sum + Number(item.status?.completedResourceSize || 0), 0),
    routeVersion: selected.items[0]?.metadata?.routeVersion || null,
    mapStyle: OFFLINE_MAP_STYLE_URL,
  };
}

async function downloadPack(options, segmentIndex, segmentCount, onProgress) {
  const OfflineManager = manager();
  let timer;
  let packId;
  let settle;
  let fail;
  const completed = new Promise((resolve, reject) => { settle = resolve; fail = reject; });
  const progressListener = (pack, status) => {
    packId = pack?.id || packId;
    const percentage = Math.max(0, Math.min(100, Number(status?.percentage || 0)));
    onProgress?.({
      segmento: segmentIndex + 1,
      segmentos: segmentCount,
      progreso: Math.round(((segmentIndex + percentage / 100) / segmentCount) * 100),
      recursos: Number(status?.completedResourceCount || 0),
    });
    if (isComplete(status)) settle(pack);
  };
  const errorListener = (_pack, error) => fail(new Error(error?.message || 'No fue posible descargar el mapa offline.'));
  const pack = await OfflineManager.createPack(options, progressListener, errorListener);
  packId = pack.id;
  const status = await pack.status();
  if (isComplete(status)) settle(pack);
  else await pack.resume();
  timer = setTimeout(() => fail(new Error('La descarga del mapa offline excedio el tiempo permitido.')), DOWNLOAD_TIMEOUT_MS);
  try {
    await completed;
    return pack;
  } finally {
    clearTimeout(timer);
    if (packId) OfflineManager.removeListener(packId);
  }
}

export async function prepararMapaSinConexion({ routeKey, route, mapTheme = 'day', onProgress }) {
  if (!OFFLINE_MAP_STYLE_URL) {
    throw new Error('Falta el estilo cartografico necesario para preparar el mapa offline.');
  }
  const owner = await ownerId();
  if (!owner) throw new Error('Inicia sesion antes de descargar un mapa offline.');
  const segments = segmentarCorredorRuta(route, OFFLINE_MAP_SEGMENT_KM);
  if (!routeKey || !segments.length) throw new Error('Primero carga una ruta valida para preparar el mapa offline.');
  const bounds = segments.map((segment) => limitesCorredor(segment, OFFLINE_MAP_CORRIDOR_KM));
  const estimatedTiles = bounds.reduce(
    (total, item) => total + estimarCantidadTiles(item, OFFLINE_MAP_MIN_ZOOM, OFFLINE_MAP_MAX_ZOOM),
    0,
  );
  if (estimatedTiles > OFFLINE_MAP_TILE_LIMIT) {
    throw new Error(`El corredor necesita aproximadamente ${estimatedTiles.toLocaleString('es-CO')} teselas, por encima del limite de ${OFFLINE_MAP_TILE_LIMIT.toLocaleString('es-CO')}. Reduce zoom o corredor.`);
  }
  const estimatedBytes = estimarTamanoDescargaBytes(
    estimatedTiles,
    OFFLINE_MAP_ESTIMATED_TILE_KB,
  );
  const freeSpaceBytes = Number(Paths.availableDiskSpace);
  const reserveBytes = OFFLINE_MAP_MIN_FREE_MB * BYTES_PER_MB;
  if (Number.isFinite(freeSpaceBytes) && freeSpaceBytes > 0 && freeSpaceBytes < estimatedBytes + reserveBytes) {
    const requiredMb = Math.ceil((estimatedBytes + reserveBytes) / BYTES_PER_MB);
    const availableMb = Math.floor(freeSpaceBytes / BYTES_PER_MB);
    throw new Error(`No hay espacio suficiente para el mapa. Se requieren aproximadamente ${requiredMb.toLocaleString('es-CO')} MB libres y hay ${availableMb.toLocaleString('es-CO')} MB.`);
  }
  const OfflineManager = manager();
  OfflineManager.setTileCountLimit(OFFLINE_MAP_TILE_LIMIT);
  OfflineManager.setProgressEventThrottle(500);
  const routeVersion = versionRuta(route);
  const existing = await relevantPacks(routeKey, owner);
  const exact = existing.filter((pack) => {
    const metadata = metadataOf(pack);
    return metadata.routeVersion === routeVersion && metadata.mapTheme === mapTheme;
  });
  if (exact.length === segments.length) {
    const statuses = await Promise.all(exact.map((pack) => pack.status()));
    if (statuses.every(isComplete)) return obtenerEstadoMapaSinConexion(routeKey);
  }
  const created = [];
  try {
    for (let index = 0; index < segments.length; index += 1) {
      const pack = await downloadPack({
        mapStyle: OFFLINE_MAP_STYLE_URL,
        minZoom: OFFLINE_MAP_MIN_ZOOM,
        maxZoom: OFFLINE_MAP_MAX_ZOOM,
        bounds: bounds[index],
        metadata: {
          namespace: NAMESPACE,
          ownerId: String(owner),
          routeKey: String(routeKey),
          routeVersion,
          mapTheme,
          segmentIndex: index,
          segmentCount: segments.length,
          downloadedAt: new Date().toISOString(),
        },
      }, index, segments.length, onProgress);
      created.push(pack);
    }
  } catch (error) {
    await Promise.all(created.map((pack) => OfflineManager.deletePack(pack.id).catch(() => {})));
    throw error;
  }
  const obsolete = existing.filter((pack) => !created.some((createdPack) => createdPack.id === pack.id));
  await Promise.all(obsolete.map((pack) => OfflineManager.deletePack(pack.id).catch(() => {})));
  return {
    ...(await obtenerEstadoMapaSinConexion(routeKey)),
    teselasEstimadas: estimatedTiles,
    bytesEstimados: estimatedBytes,
    espacioLibreBytes: Number.isFinite(freeSpaceBytes) ? freeSpaceBytes : null,
  };
}

export async function eliminarMapaSinConexion(routeKey) {
  const owner = await ownerId();
  if (!owner || !routeKey || RUNNING_IN_EXPO_GO) return;
  const OfflineManager = manager();
  const packs = await relevantPacks(routeKey, owner);
  await Promise.all(packs.map((pack) => OfflineManager.deletePack(pack.id)));
}
