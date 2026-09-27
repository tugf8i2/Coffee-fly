const mockActivate = jest.fn(() => Promise.resolve());
const mockDeactivate = jest.fn(() => Promise.resolve());

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (...args) => mockActivate(...args),
  deactivateKeepAwake: (...args) => mockDeactivate(...args),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import useKeepNavigationAwake from '../src/ganchos/usarPantallaActiva';

function Probe({ enabled }) {
  useKeepNavigationAwake(enabled);
  return null;
}

describe('pantalla activa durante navegación', () => {
  beforeEach(() => jest.clearAllMocks());

  test('activa el bloqueo y lo libera al salir', async () => {
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<Probe enabled />); });
    expect(mockActivate).toHaveBeenCalledWith('coffee-fly-navigation');
    await act(async () => { renderer.update(<Probe enabled={false} />); });
    expect(mockDeactivate).toHaveBeenCalledWith('coffee-fly-navigation');
    await act(async () => { renderer.unmount(); });
  });
});
