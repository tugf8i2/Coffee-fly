import * as SecureStore from 'expo-secure-store';
import { saveAuthenticatedSession } from '../src/servicios/sesionSeguimiento.native';

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'after_first_unlock',
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

test('la foto del conductor no infla la sesión segura', async () => {
  const photo = `data:image/png;base64,${'a'.repeat(10000)}`;
  await saveAuthenticatedSession({ id: 7, rol: 'conductor', foto_perfil: photo }, 'token');
  const saved = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1]);
  expect(saved.user).toEqual({ id: 7, rol: 'conductor' });
  expect(saved.token).toBe('token');
});
