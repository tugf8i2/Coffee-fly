export function createClientUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (digit) => {
    const value = Math.floor(Math.random() * 16);
    return (digit === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
