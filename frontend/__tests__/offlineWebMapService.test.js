jest.mock('../src/servicios/sesionSeguimiento', () => ({
  getAuthenticatedSession: jest.fn(async () => ({ user: { id: 7 } })),
}));

import {
  eliminarMapaSinConexion,
  obtenerEstadoMapaSinConexion,
  prepararMapaSinConexion,
} from '../src/servicios/mapaSinConexion.web';

const route = [
  { latitude: 4.5339, longitude: -75.6811 },
  { latitude: 4.539, longitude: -75.676 },
];

describe('descarga del corredor en el WebView', () => {
  let stores;
  let originalFetch;
  let originalCaches;

  beforeEach(() => {
    const values = new Map();
    window.localStorage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    stores = new Map();
    originalFetch = global.fetch;
    originalCaches = global.caches;
    global.caches = {
      open: jest.fn(async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const items = stores.get(name);
        return {
          match: async (url) => items.get(url),
          put: async (url, response) => { items.set(url, response); },
          keys: async () => [...items.keys()],
        };
      }),
      delete: jest.fn(async (name) => stores.delete(name)),
    };
    window.caches = global.caches;
    global.fetch = jest.fn(async (url) => {
      let body;
      if (url.endsWith('/styles/liberty')) body = {
        sources: { openmaptiles: { url: 'https://tiles.openfreemap.org/planet' } },
        layers: [],
      };
      if (url.endsWith('/planet')) body = {
        maxzoom: 14,
        tiles: ['https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf'],
      };
      return { ok: true, clone() { return this; }, async json() { return body; } };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.caches = originalCaches;
    window.caches = originalCaches;
  });

  test('descarga las teselas de todo el corredor y reconoce el paquete al volver a abrir', async () => {
    const state = await prepararMapaSinConexion({ routeKey: 'viaje-11', route });
    expect(state.listo).toBe(true);
    expect(state.recursos).toBeGreaterThan(2);
    expect([...stores.values()].flatMap((items) => [...items.keys()]).some((url) => url.includes('/14/'))).toBe(true);
    expect((await obtenerEstadoMapaSinConexion('viaje-11', route)).listo).toBe(true);
    await eliminarMapaSinConexion('viaje-11');
    expect((await obtenerEstadoMapaSinConexion('viaje-11', route)).listo).toBe(false);
  });
});
