export async function readDriverValue(key) {
  return globalThis.localStorage.getItem(key);
}
export async function writeDriverValue(key, value) {
  globalThis.localStorage.setItem(key, value);
}
