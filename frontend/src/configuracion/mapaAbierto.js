export const MAPLIBRE_VERSION = '6.9.0';
export const OPEN_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const OPEN_MAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const DEFAULT_MAP_CENTER = [-75.6811, 4.5339];
export const DEFAULT_MAP_ZOOM = 13;

const envNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

// Puede sustituirse por la infraestructura cartografica de Coffee Fly. El
// estilo publico de OpenFreeMap mantiene el APK funcional desde la primera
// instalacion y MapLibre conserva localmente el corredor de cada ruta.
export const OFFLINE_MAP_STYLE_URL = (
  process.env.EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL || OPEN_MAP_STYLE_URL
).trim();
export const OFFLINE_MAP_CORRIDOR_KM = envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_CORRIDOR_KM, 5, 0.5, 25);
export const OFFLINE_MAP_SEGMENT_KM = envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_SEGMENT_KM, 20, 2, 100);
export const OFFLINE_MAP_MIN_ZOOM = envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_MIN_ZOOM, 9, 0, 20);
export const OFFLINE_MAP_MAX_ZOOM = Math.max(
  OFFLINE_MAP_MIN_ZOOM,
  envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_MAX_ZOOM, 16, 0, 20),
);
export const OFFLINE_MAP_TILE_LIMIT = Math.round(envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_TILE_LIMIT, 30000, 1000, 100000));
// La estimacion es preventiva: el tamaño final depende del estilo y de la
// densidad cartografica. El margen libre evita llenar el almacenamiento del
// telefono durante una descarga incompleta.
export const OFFLINE_MAP_ESTIMATED_TILE_KB = envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_ESTIMATED_TILE_KB, 25, 1, 250);
export const OFFLINE_MAP_MIN_FREE_MB = envNumber(process.env.EXPO_PUBLIC_OFFLINE_MAP_MIN_FREE_MB, 250, 50, 2048);
// El export estatico de Expo no publica automaticamente el worker ESM que
// MapLibre intenta resolver junto al bundle. Se copia este worker CSP al
// directorio public durante el build y se sirve desde el mismo origen.
export const MAPLIBRE_WORKER_URL = '/maplibre-gl-csp-worker.js';
