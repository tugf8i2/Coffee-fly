export const MAPLIBRE_VERSION = '6.9.0';
export const OPEN_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const DEFAULT_MAP_CENTER = [-75.6811, 4.5339];
export const DEFAULT_MAP_ZOOM = 13;
export const OPEN_STREET_MAP_RASTER_STYLE = {
  version: 8,
  sources: {
    'openstreetmap-streets': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{
    id: 'openstreetmap-streets',
    type: 'raster',
    source: 'openstreetmap-streets',
  }],
};
// El export estatico de Expo no publica automaticamente el worker ESM que
// MapLibre intenta resolver junto al bundle. Se copia este worker CSP al
// directorio public durante el build y se sirve desde el mismo origen.
export const MAPLIBRE_WORKER_URL = '/maplibre-gl-csp-worker.js';
