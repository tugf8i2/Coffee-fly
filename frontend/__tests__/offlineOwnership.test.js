import {
  assignLegacyOwner,
  belongsToOwner,
  offlineOwnerId,
  ownedStorageKey,
} from '../src/services/offlineOwnership';

describe('aislamiento de datos offline por usuario', () => {
  test('obtiene una identidad estable desde la sesión autenticada', () => {
    expect(offlineOwnerId({ user: { id_usuario: 42 } })).toBe('42');
    expect(offlineOwnerId({ user: {} })).toBeNull();
    expect(ownedStorageKey('dashboard', '42')).toBe('dashboard:usuario:42');
  });

  test('un usuario no puede seleccionar operaciones de otro', () => {
    expect(belongsToOwner({ owner_id: '42' }, '42')).toBe(true);
    expect(belongsToOwner({ owner_id: '7' }, '42')).toBe(false);
    expect(belongsToOwner({}, '42')).toBe(false);
  });

  test('la migración reclama sólo registros heredados y conserva dueños existentes', () => {
    const migrated = assignLegacyOwner([
      { id: 'legacy' },
      { id: 'existing', owner_id: '7' },
    ], '42');
    expect(migrated).toEqual([
      { id: 'legacy', owner_id: '42' },
      { id: 'existing', owner_id: '7' },
    ]);
  });
});
