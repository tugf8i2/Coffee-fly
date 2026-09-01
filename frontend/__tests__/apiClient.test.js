import { fetchApi, subscribeSessionExpired } from '../src/config/Api';

describe('cliente API resiliente', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('notifica una sesión expirada solamente en peticiones autenticadas', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSessionExpired(listener);
    global.fetch = jest.fn().mockResolvedValue({ status: 401 });

    await fetchApi('https://api.test/me', { headers: { Authorization: 'Bearer token' } });
    expect(listener).toHaveBeenCalledTimes(1);

    listener.mockClear();
    await fetchApi('https://api.test/login', { method: 'POST' });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test('convierte un fallo de red en un mensaje comprensible', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchApi('https://api.test/data')).rejects.toThrow('No fue posible conectar con Coffee Fly');
  });

  test('cancela una petición que supera el tiempo límite', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const request = fetchApi('https://api.test/slow', { timeoutMs: 100 });
    jest.advanceTimersByTime(101);
    await expect(request).rejects.toThrow('La solicitud tardó demasiado');
  });
});
