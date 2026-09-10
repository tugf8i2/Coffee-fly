import { buscarDirecciones, obtenerDireccion } from '../src/servicios/busquedaDirecciones';

describe('búsqueda de direcciones', () => {
  afterEach(() => jest.restoreAllMocks());

  test('no consulta textos demasiado cortos', async () => {
    global.fetch = jest.fn();
    await expect(buscarDirecciones('ab')).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('convierte sugerencias geográficas en direcciones seleccionables', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{
        properties: { name: 'Parque del Café', city: 'Pueblo Tapao', state: 'Quindío', country: 'Colombia' },
        geometry: { coordinates: [-75.7692713, 4.5373265] },
      }] }),
    });

    const results = await buscarDirecciones('Parque del Café');
    expect(results[0]).toEqual({
      direccion: 'Parque del Café, Pueblo Tapao, Quindío, Colombia',
      latitude: 4.5373265,
      longitude: -75.7692713,
    });
  });

  test('informa una dirección al seleccionar el mapa', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{
        properties: { street: 'Carrera 15', housenumber: '10-20', city: 'Armenia', country: 'Colombia' },
        geometry: { coordinates: [-75.68, 4.53] },
      }] }),
    });

    await expect(obtenerDireccion(4.53, -75.68)).resolves.toBe('Carrera 15 10-20, Armenia, Colombia');
  });
});
