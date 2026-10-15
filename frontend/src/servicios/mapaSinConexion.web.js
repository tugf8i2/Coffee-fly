import {
  OFFLINE_MAP_CORRIDOR_KM, OFFLINE_MAP_MAX_ZOOM, OFFLINE_MAP_TILE_LIMIT,
  OPEN_MAP_DARK_STYLE_URL, OPEN_MAP_STYLE_URL,
} from '../configuracion/mapaAbierto';
import { offlineOwnerId } from './propietarioSinConexion';
import { getAuthenticatedSession } from './sesionSeguimiento';
import { limitesCorredor, segmentarCorredorRuta, versionRuta } from './mapaSinConexionCalculos';

const NAMESPACE = 'coffee-fly-map-route-v1';
const META_PREFIX = 'coffee-fly:map-route:v1:';
const MAX_PARALLEL = 6;
const radians = (degrees) => degrees * Math.PI / 180;

const hash = (value) => {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
};

async function scope(routeKey) {
  const owner = offlineOwnerId(await getAuthenticatedSession());
  return owner && routeKey ? `${owner}:${routeKey}` : null;
}

function tileUrls(template, bounds, minZoom, maxZoom) {
  const urls = new Set();
  const [west, south, east, north] = bounds;
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const size = 2 ** zoom;
    const x = (lng) => Math.max(0, Math.min(size - 1, Math.floor((lng + 180) / 360 * size)));
    const y = (lat) => Math.max(0, Math.min(size - 1, Math.floor((1 - Math.asinh(Math.tan(radians(lat))) / Math.PI) / 2 * size)));
    for (let column = x(west); column <= x(east); column += 1) {
      for (let row = y(north); row <= y(south); row += 1) {
        urls.add(template.replace('{z}', zoom).replace('{x}', column).replace('{y}', row));
      }
    }
  }
  return urls;
}

function readMetadata(key) {
  try { return JSON.parse(window.localStorage.getItem(META_PREFIX + key)); } catch { return null; }
}

export function mapaSinConexionConfigurado() {
  return typeof window !== 'undefined' && 'caches' in window;
}

export async function obtenerEstadoMapaSinConexion(routeKey, route = null) {
  if (!mapaSinConexionConfigurado()) return { disponible: false, listo: false, motivo: 'Este dispositivo no permite almacenar mapas offline.' };
  const key = await scope(routeKey);
  const metadata = key ? readMetadata(key) : null;
  if (!metadata || (route?.length && metadata.routeVersion !== versionRuta(route))) {
    return { disponible: true, listo: false, progreso: 0, recursos: 0 };
  }
  const cache = await caches.open(metadata.cacheName);
  const keys = await cache.keys();
  const ready = keys.length >= metadata.resourceCount;
  return {
    disponible: true,
    listo: ready,
    progreso: ready ? 100 : Math.floor(keys.length / metadata.resourceCount * 100),
    recursos: keys.length,
    routeVersion: metadata.routeVersion,
    motivo: ready ? null : 'Faltan recursos del mapa. Conéctate para completar la descarga.',
  };
}

export async function prepararMapaSinConexion({ routeKey, route, mapTheme = 'day', onProgress }) {
  if (!mapaSinConexionConfigurado()) throw new Error('Este dispositivo no permite almacenar mapas offline.');
  const key = await scope(routeKey);
  if (!key) throw new Error('Inicia sesión antes de descargar el mapa.');
  const segments = segmentarCorredorRuta(route);
  if (!segments.length) throw new Error('Primero carga una ruta válida para preparar el mapa.');
  const routeVersion = versionRuta(route);
  const existing = readMetadata(key);
  if (existing?.routeVersion === routeVersion && existing?.mapTheme === mapTheme) {
    const state = await obtenerEstadoMapaSinConexion(routeKey, route);
    if (state.listo) return state;
  }

  const styleUrl = mapTheme === 'dark' ? OPEN_MAP_DARK_STYLE_URL : OPEN_MAP_STYLE_URL;
  const styleResponse = await fetch(styleUrl);
  if (!styleResponse.ok) throw new Error('No se pudo descargar el estilo del mapa.');
  const style = await styleResponse.clone().json();
  const tileJsonUrl = style.sources?.openmaptiles?.url;
  if (!tileJsonUrl) throw new Error('El estilo del mapa no contiene la fuente de calles.');
  const tileJsonResponse = await fetch(tileJsonUrl);
  if (!tileJsonResponse.ok) throw new Error('No se pudo descargar la fuente de calles.');
  const tileJson = await tileJsonResponse.clone().json();
  const vectorTemplate = tileJson.tiles?.[0];
  if (!vectorTemplate) throw new Error('La fuente del mapa no ofrece teselas.');

  const bounds = segments.map((segment) => limitesCorredor(segment, OFFLINE_MAP_CORRIDOR_KM));
  const resources = new Set([styleUrl, tileJsonUrl]);
  const maximumZoom = Math.min(OFFLINE_MAP_MAX_ZOOM, Number(tileJson.maxzoom) || 14);
  for (const area of bounds) {
    for (const url of tileUrls(vectorTemplate, area, 0, maximumZoom)) resources.add(url);
    const rasterTemplate = style.sources?.ne2_shaded?.tiles?.[0];
    if (rasterTemplate) for (const url of tileUrls(rasterTemplate, area, 0, 6)) resources.add(url);
  }
  if (resources.size > OFFLINE_MAP_TILE_LIMIT) {
    throw new Error(`La ruta requiere ${resources.size.toLocaleString('es-CO')} recursos de mapa, por encima del límite configurado.`);
  }
  if (style.sprite) {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) resources.add(style.sprite + suffix);
  }
  if (style.glyphs) {
    const fonts = new Set(style.layers.flatMap((layer) => {
      const font = layer.layout?.['text-font'];
      return Array.isArray(font) && font.every((part) => typeof part === 'string') ? [font.join(',')] : [];
    }));
    for (const font of fonts) {
      for (const range of ['0-255', '256-511']) {
        resources.add(style.glyphs.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range));
      }
    }
  }

  const cacheName = `${NAMESPACE}-${hash(key)}-${routeVersion}-${mapTheme}`;
  const cache = await caches.open(cacheName);
  const urls = [...resources];
  let completed = 0;
  let next = 0;
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      if (!(await cache.match(url))) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`No se pudo guardar el mapa: ${new URL(url).pathname}`);
        await cache.put(url, response);
      }
      completed += 1;
      if (completed % 10 === 0 || completed === urls.length) {
        onProgress?.({ progreso: Math.round(completed / urls.length * 100), recursos: completed });
      }
    }
  });
  await Promise.all(workers);
  window.localStorage.setItem(META_PREFIX + key, JSON.stringify({ cacheName, routeVersion, mapTheme, resourceCount: urls.length }));
  if (existing?.cacheName && existing.cacheName !== cacheName) await caches.delete(existing.cacheName);
  return obtenerEstadoMapaSinConexion(routeKey, route);
}

export async function eliminarMapaSinConexion(routeKey) {
  const key = await scope(routeKey);
  if (!key) return;
  const metadata = readMetadata(key);
  if (metadata?.cacheName) await caches.delete(metadata.cacheName);
  window.localStorage.removeItem(META_PREFIX + key);
}
