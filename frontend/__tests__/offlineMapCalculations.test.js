import {
  estimarCantidadTiles,
  estimarTamanoDescargaBytes,
  limitesCorredor,
  segmentarCorredorRuta,
  versionRuta,
} from '../src/servicios/mapaSinConexionCalculos';

const route = [
  { latitude: 4.5339, longitude: -75.6811 },
  { latitude: 4.62, longitude: -75.64 },
  { latitude: 4.71, longitude: -75.59 },
  { latitude: 4.80, longitude: -75.53 },
];

describe('paquetes regionales de navegacion offline', () => {
  test('divide una ruta larga en corredores con continuidad', () => {
    const segments = segmentarCorredorRuta(route, 12);
    expect(segments.length).toBeGreaterThan(1);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index][0]).toEqual(segments[index - 1].at(-1));
    }
  });

  test('amplia limites y estima teselas para el rango de zoom', () => {
    const bounds = limitesCorredor(route.slice(0, 2), 5);
    expect(bounds[0]).toBeLessThan(route[0].longitude);
    expect(bounds[1]).toBeLessThan(route[0].latitude);
    expect(bounds[2]).toBeGreaterThan(route[1].longitude);
    expect(bounds[3]).toBeGreaterThan(route[1].latitude);
    expect(estimarCantidadTiles(bounds, 9, 16)).toBeGreaterThan(0);
  });

  test('versiona la geometria de forma estable y sensible a cambios', () => {
    expect(versionRuta(route)).toBe(versionRuta(route.map((point) => ({ ...point }))));
    expect(versionRuta(route)).not.toBe(versionRuta([...route, { latitude: 4.9, longitude: -75.4 }]));
  });

  test('estima el espacio de descarga a partir de las teselas', () => {
    expect(estimarTamanoDescargaBytes(1000, 25)).toBe(25 * 1024 * 1000);
    expect(estimarTamanoDescargaBytes(-1, 25)).toBe(0);
  });

  test('descarta coordenadas invalidas antes de segmentar', () => {
    expect(segmentarCorredorRuta([route[0], { latitude: 99, longitude: 0 }, route[1]], 50)).toHaveLength(1);
  });
});
