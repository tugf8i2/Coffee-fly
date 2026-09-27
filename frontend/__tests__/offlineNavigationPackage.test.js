jest.mock('../src/configuracion/mapaAbierto', () => ({
  OFFLINE_MAP_STYLE_URL: 'https://maps.coffeefly.test/styles/navigation.json',
}));

import {
  attachOfflineMapPackage,
  createOfflineNavigationPackage,
} from '../src/servicios/paqueteNavegacionOffline';

const points = [
  { latitude: 4.53, longitude: -75.69 },
  { latitude: 4.55, longitude: -75.65 },
];

describe('paquete de navegación offline', () => {
  test('incluye ruta, viaje, límites y metadatos versionados', () => {
    const result = createOfflineNavigationPackage({
      route: { puntos: points, instrucciones: [{ texto: 'Continúa', distancia_m: 100 }], distancia_m: 100, duracion_s: 20, proveedor: 'valhalla' },
      tripId: 'trip-1',
      deliveryId: 'delivery-1',
      stage: 'hacia_finca',
      origin: points[0],
      destination: points[1],
    });

    expect(result).toMatchObject({
      tripId: 'trip-1',
      origin: points[0],
      destination: points[1],
      routeGeometry: points,
      routeDistance: 100,
      routeDuration: 20,
      mapBounds: { west: -75.69, south: 4.53, east: -75.65, north: 4.55 },
      mapPackage: { routeKey: 'delivery-1:hacia_finca', status: 'not_downloaded' },
      mapStyle: 'https://maps.coffeefly.test/styles/navigation.json',
      navigationMetadata: { provider: 'valhalla' },
    });
    expect(result.navigationMetadata.version).toBeTruthy();
  });

  test('registra tamaño y versión al completar el mapa', () => {
    const route = createOfflineNavigationPackage({
      route: { puntos: points }, deliveryId: 'delivery-1', stage: 'hacia_finca',
    });
    const result = attachOfflineMapPackage(route, {
      listo: true, routeVersion: 'abc', bytes: 5000, paquetes: 2, recursos: 80,
    });
    expect(result.mapPackage).toMatchObject({
      status: 'ready', version: 'abc', size: 5000, packs: 2, resources: 80,
    });
    expect(result.mapPackage.downloadDate).toBeTruthy();
  });
});
