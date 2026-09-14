import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OPEN_STREET_MAP_RASTER_STYLE,
} from '../src/configuracion/mapaAbierto';

describe('configuración del mapa de calles', () => {
  test('abre con detalle urbano sobre la zona cafetera', () => {
    expect(DEFAULT_MAP_CENTER).toEqual([-75.6811, 4.5339]);
    expect(DEFAULT_MAP_ZOOM).toBeGreaterThanOrEqual(12);
  });

  test('usa mosaicos de calles de OpenStreetMap', () => {
    const source = OPEN_STREET_MAP_RASTER_STYLE.sources['openstreetmap-streets'];
    expect(source.type).toBe('raster');
    expect(source.tiles[0]).toContain('tile.openstreetmap.org');
    expect(OPEN_STREET_MAP_RASTER_STYLE.layers[0].source).toBe('openstreetmap-streets');
  });
});
