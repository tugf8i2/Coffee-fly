export function offlineOwnerId(session) {
  const value = session?.user?.id_usuario;
  return value == null || value === '' ? null : String(value);
}

export function ownedStorageKey(key, ownerId) {
  return ownerId ? `${key}:usuario:${ownerId}` : null;
}

export function belongsToOwner(item, ownerId) {
  return Boolean(ownerId) && String(item?.owner_id || '') === String(ownerId);
}

export function assignLegacyOwner(items, ownerId) {
  if (!ownerId) return items;
  return items.map((item) => (item.owner_id ? item : { ...item, owner_id: String(ownerId) }));
}
