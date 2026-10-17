describe('sesión web dentro de la APK', () => {
  let saved;

  beforeEach(() => {
    saved = null;
    jest.resetModules();
    const listeners = [];
    window.addEventListener = jest.fn((_name, listener) => listeners.push(listener));
    window.dispatchEvent = jest.fn((event) => listeners.forEach((listener) => listener(event)));
    window.__COFFEE_FLY_SECURE_SESSION_BRIDGE__ = true;
    window.ReactNativeWebView = {
      postMessage: jest.fn((raw) => {
        const request = JSON.parse(raw);
        if (request.action === 'set') saved = request.value;
        if (request.action === 'delete') saved = null;
        const value = request.action === 'get' ? saved : null;
        queueMicrotask(() => window.dispatchEvent({ detail: { requestId: request.requestId, value } }));
      }),
    };
  });

  afterEach(() => {
    delete window.ReactNativeWebView;
    delete window.__COFFEE_FLY_SECURE_SESSION_BRIDGE__;
  });

  test('restaura la cuenta después de reiniciar y la elimina al cerrar sesión', async () => {
    const firstRun = require('../src/servicios/sesionSeguimiento.web');
    await firstRun.saveAuthenticatedSession({ id: 7, nombre: 'Ana', foto_perfil: 'imagen-grande' }, 'token-123');
    expect(saved.user.foto_perfil).toBeUndefined();

    jest.resetModules();
    const afterRestart = require('../src/servicios/sesionSeguimiento.web');
    expect(await afterRestart.getAuthenticatedSession()).toEqual(expect.objectContaining({ token: 'token-123' }));
    await afterRestart.clearAuthenticatedSession();
    expect(saved).toBeNull();
  });

  test('restaura la sesión aunque el marcador se inyecte tarde en Android', async () => {
    const firstRun = require('../src/servicios/sesionSeguimiento.web');
    await firstRun.saveAuthenticatedSession({ id: 7, nombre: 'Ana' }, 'token-123');
    delete window.__COFFEE_FLY_SECURE_SESSION_BRIDGE__;
    jest.resetModules();
    const afterRestart = require('../src/servicios/sesionSeguimiento.web');
    expect(await afterRestart.getAuthenticatedSession()).toEqual(expect.objectContaining({ token: 'token-123' }));
  });
});
