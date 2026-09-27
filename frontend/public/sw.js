const CACHE_VERSION = 'coffee-fly-shell-v1';
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
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

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
