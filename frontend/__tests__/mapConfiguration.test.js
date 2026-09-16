import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OPEN_MAP_STYLE_URL,
} from '../src/configuracion/mapaAbierto';

describe('configuración del mapa de calles', () => {
  test('abre con detalle urbano sobre la zona cafetera', () => {
    expect(DEFAULT_MAP_CENTER).toEqual([-75.6811, 4.5339]);
    expect(DEFAULT_MAP_ZOOM).toBeGreaterThanOrEqual(12);
  });

  test('usa un estilo vectorial compatible con MapLibre sin abusar del servidor estándar de OSM', () => {
    expect(OPEN_MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(OPEN_MAP_STYLE_URL).not.toContain('tile.openstreetmap.org');
  });
});
