import { obtenerCalleActual } from '../src/servicios/calleActual';

describe('calle actual', () => {
  afterEach(() => jest.restoreAllMocks());

  test('obtiene el nombre vial más cercano a las coordenadas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ waypoints: [{ name: 'Carrera 96G' }] }),
    });

    await expect(obtenerCalleActual(4.65, -74.12)).resolves.toBe('Carrera 96G');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('-74.12,4.65'),
      { signal: undefined },
    );
  });

  test('retorna vacío cuando la vía no tiene nombre', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ waypoints: [{ name: '' }] }) });
    await expect(obtenerCalleActual(4.65, -74.12)).resolves.toBeNull();
  });
});
