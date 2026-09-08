import { fetchApi, resolveApiBaseUrl, subscribeSessionExpired } from '../src/configuracion/ClienteApi';

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
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('descubre FastAPI desde la IP LAN publicada por Metro', () => {
    expect(resolveApiBaseUrl('', 'android', '192.168.101.19:8081')).toBe('http://192.168.101.19:8000');
    expect(resolveApiBaseUrl('', 'web', 'localhost:8081')).toBe('/api');
    expect(resolveApiBaseUrl('https://api.example.com/', 'android', '192.168.1.2:8081')).toBe('https://api.example.com');
  });

  test('reintenta errores transitorios solamente en operaciones seguras', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });
    await expect(fetchApi('https://api.test/data', { retryDelayMs: 0 })).resolves.toMatchObject({ status: 200 });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchApi('https://api.test/data', { method: 'POST', retryDelayMs: 0 })).rejects.toThrow('No fue posible conectar');
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
