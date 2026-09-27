let mockPacks;

const mockOfflineManager = {
  createPack: jest.fn(async (options, progressListener) => {
    let complete = false;
    const pack = {
      id: `pack-${mockPacks.length + 1}`,
      metadata: options.metadata,
      status: jest.fn(async () => ({
        id: 'pack-status',
        state: complete ? 'complete' : 'inactive',
        percentage: complete ? 100 : 0,
        completedResourceCount: complete ? 42 : 0,
      })),
      resume: jest.fn(async () => {
        complete = true;
        progressListener(pack, {
          id: pack.id,
          state: 'complete',
          percentage: 100,
          completedResourceCount: 42,
        });
      }),
    };
    mockPacks.push(pack);
    return pack;
  }),
  deletePack: jest.fn(async (id) => {
    mockPacks = mockPacks.filter((pack) => pack.id !== id);
  }),
  getPacks: jest.fn(async () => mockPacks),
  removeListener: jest.fn(),
  setProgressEventThrottle: jest.fn(),
  setTileCountLimit: jest.fn(),
};

jest.mock('@maplibre/maplibre-react-native', () => ({ OfflineManager: mockOfflineManager }));
jest.mock('expo-file-system', () => ({ Paths: { availableDiskSpace: 2 * 1024 * 1024 * 1024 } }));
jest.mock('../src/configuracion/mapasNativos', () => ({ RUNNING_IN_EXPO_GO: false }));
jest.mock('../src/configuracion/mapaAbierto', () => ({
  OFFLINE_MAP_CORRIDOR_KM: 5,
  OFFLINE_MAP_ESTIMATED_TILE_KB: 25,
  OFFLINE_MAP_MAX_ZOOM: 14,
  OFFLINE_MAP_MIN_ZOOM: 9,
  OFFLINE_MAP_MIN_FREE_MB: 250,
  OFFLINE_MAP_SEGMENT_KM: 20,
  OFFLINE_MAP_STYLE_URL: 'https://maps.coffeefly.test/styles/navigation.json',
  OFFLINE_MAP_TILE_LIMIT: 30000,
}));
jest.mock('../src/servicios/sesionSeguimiento', () => ({
  getAuthenticatedSession: jest.fn(async () => ({ user: { id: 7 } })),
}));
jest.mock('../src/servicios/propietarioSinConexion', () => ({
  offlineOwnerId: jest.fn(() => 'user:7'),
}));

import {
  eliminarMapaSinConexion,
  obtenerEstadoMapaSinConexion,
  prepararMapaSinConexion,
} from '../src/servicios/mapaSinConexion.native';

const route = [
  { latitude: 4.5339, longitude: -75.6811 },
  { latitude: 4.58, longitude: -75.65 },
];

describe('servicio nativo de mapas offline', () => {
  beforeEach(() => {
    mockPacks = [];
    require('expo-file-system').Paths.availableDiskSpace = 2 * 1024 * 1024 * 1024;
    jest.clearAllMocks();
  });

  test('descarga, identifica y elimina un corredor del usuario actual', async () => {
    const progress = jest.fn();
    const prepared = await prepararMapaSinConexion({
      routeKey: '11:hacia_finca',
      route,
      onProgress: progress,
    });

    expect(prepared.listo).toBe(true);
    expect(prepared.paquetes).toBe(1);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ progreso: 100 }));
    expect(mockOfflineManager.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        mapStyle: 'https://maps.coffeefly.test/styles/navigation.json',
        bounds: expect.arrayContaining([expect.any(Number)]),
        metadata: expect.objectContaining({ ownerId: 'user:7', routeKey: '11:hacia_finca' }),
      }),
      expect.any(Function),
      expect.any(Function),
    );

    expect((await obtenerEstadoMapaSinConexion('11:hacia_finca')).listo).toBe(true);
    expect((await obtenerEstadoMapaSinConexion('11:hacia_finca', [
      ...route,
      { latitude: 4.9, longitude: -75.3 },
    ])).listo).toBe(false);
    await eliminarMapaSinConexion('11:hacia_finca');
    expect((await obtenerEstadoMapaSinConexion('11:hacia_finca')).listo).toBe(false);
  });

  test('no inicia la descarga cuando el dispositivo no tiene espacio suficiente', async () => {
    require('expo-file-system').Paths.availableDiskSpace = 100 * 1024 * 1024;

    await expect(prepararMapaSinConexion({
      routeKey: '11:hacia_finca',
      route,
    })).rejects.toThrow('No hay espacio suficiente');

    expect(mockOfflineManager.createPack).not.toHaveBeenCalled();
  });
});
