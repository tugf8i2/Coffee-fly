import { hexToBytes } from '@noble/ciphers/utils.js';

import {
  decryptWithKey,
  encryptWithKey,
  isEncryptedOfflineText,
} from '../src/services/offlineCrypto.native';


describe('cifrado offline móvil', () => {
  const key = hexToBytes('00'.repeat(32));
  const nonce = hexToBytes('01'.repeat(12));

  test('usa AES-256-GCM autenticado y recupera Unicode', () => {
    const plaintext = JSON.stringify({ latitud: 4.711, nota: 'Café recién cosechado' });
    const encrypted = encryptWithKey(plaintext, key, nonce);
    expect(isEncryptedOfflineText(encrypted)).toBe(true);
    expect(encrypted).not.toContain('4.711');
    expect(encrypted).not.toContain('Café');
    expect(decryptWithKey(encrypted, key)).toBe(plaintext);
  });

  test('detecta manipulación del texto cifrado', () => {
    const encrypted = encryptWithKey('dato sensible', key, nonce);
    const tampered = `${encrypted.slice(0, -2)}00`;
    expect(() => decryptWithKey(tampered, key)).toThrow();
  });

  test('acepta texto heredado para migración gradual', () => {
    expect(decryptWithKey('{"legacy":true}', key)).toBe('{"legacy":true}');
  });
});
