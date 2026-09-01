jest.mock('../src/config', () => ({
  API_BASE_URL: 'https://api.test',
  fetchApi: jest.fn(),
}));

import { fetchApi } from '../src/config';
import { fetchDeliveryHistories } from '../src/services/deliveryHistory';

describe('delivery history batch client', () => {
  beforeEach(() => fetchApi.mockReset());

  test('loads all histories with one API request and groups them by delivery', async () => {
    fetchApi.mockResolvedValue({
      ok: true,
      json: async () => [
        { entrega_id: 'delivery-a', id_historial: 'history-1' },
        { entrega_id: 'delivery-b', id_historial: 'history-2' },
      ],
    });
    const result = await fetchDeliveryHistories([
      { id_entrega: 'delivery-a' },
      { id_entrega: 'delivery-b' },
      { id_entrega: 'delivery-a' },
    ], 'token');

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(fetchApi.mock.calls[0][0]).toContain('entrega_id=delivery-a&entrega_id=delivery-b');
    expect(result['delivery-a']).toHaveLength(1);
    expect(result['delivery-b']).toHaveLength(1);
  });

  test('does not call the API for an empty delivery list', async () => {
    await expect(fetchDeliveryHistories([], 'token')).resolves.toEqual({});
    expect(fetchApi).not.toHaveBeenCalled();
  });
});
