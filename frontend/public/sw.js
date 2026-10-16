const CACHE_VERSION = 'coffee-fly-shell-v2';
const MAP_CACHE = 'coffee-fly-map-viewed-v1';
const MAP_CACHE_LIMIT = 800;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.png',
  '/pwa-icon-maskable.png',
  '/maplibre-gl-csp-worker.js',
  '/maplibre-gl-shared.mjs',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const manifestResponse = await fetch('/offline-assets.json', { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error('No se pudo preparar el inicio sin conexión.');
    const assets = await manifestResponse.json();
    if (!Array.isArray(assets) || !assets.some((url) => url.startsWith('/_expo/static/js/web/'))) {
      throw new Error('Faltan archivos del inicio sin conexión.');
    }
    const cache = await caches.open(CACHE_VERSION);
    const html = await fetch('/index.html', { cache: 'no-store' });
    if (!html.ok) throw new Error('No se pudo guardar la página de inicio.');
    await Promise.all([cache.put('/', html.clone()), cache.put('/index.html', html)]);
    await cache.addAll(assets);
    await Promise.allSettled(APP_SHELL.filter((url) => url !== '/' && url !== '/index.html')
      .map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('coffee-fly-shell-') && key !== CACHE_VERSION)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isApplicationAsset(request, url) {
  return url.origin === self.location.origin
    && ['script', 'style', 'font', 'image', 'worker'].includes(request.destination)
    && !url.pathname.startsWith('/api/')
    && !url.pathname.startsWith('/osrm/');
}

function isMapResource(request, url) {
  return request.method === 'GET' && url.origin === 'https://tiles.openfreemap.org';
}

async function cachedMapResource(request) {
  const routeSaved = await caches.match(request);
  if (routeSaved) return routeSaved;
  const cache = await caches.open(MAP_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    try {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > MAP_CACHE_LIMIT) {
        await Promise.all(keys.slice(0, keys.length - MAP_CACHE_LIMIT).map((key) => cache.delete(key)));
      }
    } catch {
      // El mapa en línea sigue funcionando si el dispositivo no permite guardar más datos.
    }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (isMapResource(event.request, url)) {
    event.respondWith(cachedMapResource(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy)));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  if (!isApplicationAsset(event.request, url)) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const refreshed = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      });
      return cached || refreshed;
    }),
  );
});
