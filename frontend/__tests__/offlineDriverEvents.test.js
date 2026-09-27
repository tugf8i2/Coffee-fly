const mockFetchApi = jest.fn();

jest.mock('../src/configuracion', () => ({
  API_BASE_URL: 'https://api.coffeefly.test',
  fetchApi: (...args) => mockFetchApi(...args),
}));
jest.mock('../src/servicios/sesionSeguimiento', () => ({
  getAuthenticatedSession: jest.fn(async () => ({
    token: 'token-1',
    user: { id: 7 },
  })),
}));

import { enviarOSolicitarEnCola } from '../src/servicios/sinConexion.web';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) ?? null),
    setItem: jest.fn((key, value) => values.set(key, String(value))),
    removeItem: jest.fn((key) => values.delete(key)),
    clear: jest.fn(() => values.clear()),
  };
}

const incident = {
  entrega_id: '44cf5eb5-9b60-46d3-b015-38cf042180e2',
  tipo_evento: 'retraso',
  detalle: 'Derrumbe en la vía',
  client_event_id: '8514599b-405f-4188-8462-af190bf42974',
  capturada_en: '2026-09-26T15:00:00.000Z',
};
const inspection = {
  client_inspection_id: 'd880f7f3-afb8-4711-9738-4511468c30f6',
  vehiculo_id: 4,
  viaje_id: 'd57ce15e-612e-4bcb-b028-58626580e9fa',
  capturada_en: '2026-09-26T15:10:00.000Z',
  items: [],
};

describe('novedades del conductor offline', () => {
  beforeEach(() => {
    mockFetchApi.mockReset();
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: { localStorage: memoryStorage() },
    });
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
  });

  test('envía al endpoint de novedades con metadatos idempotentes', async () => {
    mockFetchApi.mockResolvedValue({
      ok: true,
      json: async () => ({ id_evento: 'server-event' }),
    });

    const result = await enviarOSolicitarEnCola('evento_conductor', incident, 'token-1');

    expect(result.offline).toBe(false);
    expect(mockFetchApi).toHaveBeenCalledWith(
      `https://api.coffeefly.test/entregas/${incident.entrega_id}/eventos-conductor`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          tipo_evento: incident.tipo_evento,
          detalle: incident.detalle,
          client_event_id: incident.client_event_id,
          capturada_en: incident.capturada_en,
        }),
      }),
    );
  });

  test('guarda una sola copia al repetir el mismo incidente sin red', async () => {
    Object.defineProperty(global.navigator, 'onLine', { configurable: true, value: false });

    await enviarOSolicitarEnCola('evento_conductor', incident, 'token-1');
    await enviarOSolicitarEnCola('evento_conductor', incident, 'token-1');

    const queued = JSON.parse(window.localStorage.getItem('coffee-fly-sync-queue'));
    expect(queued).toHaveLength(1);
    expect(queued[0].clave_idempotencia).toBe(`evento_conductor:${incident.client_event_id}`);
    expect(mockFetchApi).not.toHaveBeenCalled();
  });

  test('guarda una inspección sin red con clave idempotente', async () => {
    Object.defineProperty(global.navigator, 'onLine', { configurable: true, value: false });
    await enviarOSolicitarEnCola('inspeccion_vehiculo', inspection, 'token-1');
    await enviarOSolicitarEnCola('inspeccion_vehiculo', inspection, 'token-1');
    const queued = JSON.parse(window.localStorage.getItem('coffee-fly-sync-queue'));
    expect(queued).toHaveLength(1);
    expect(queued[0].clave_idempotencia).toBe(`inspeccion_vehiculo:${inspection.client_inspection_id}`);
  });
});
