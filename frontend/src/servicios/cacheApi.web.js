import { getAuthenticatedSession } from './sesionSeguimiento';

const PREFIX = 'coffee-fly:api-cache:v1';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
};

async function keyFor(input) {
  const session = await getAuthenticatedSession();
  const owner = session?.user?.id || session?.user?.id_usuario;
  return owner ? `${PREFIX}:${owner}:${hash(String(input))}` : null;
}

export async function storeApiResponse(input, response) {
  if (!response?.clone) return;
  const contentType = response.headers?.get?.('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('application/json')) return;
  const body = await response.clone().text();
  if (new Blob([body]).size > MAX_RESPONSE_BYTES) return;
  const key = await keyFor(input);
  if (key) globalThis.localStorage.setItem(key, JSON.stringify({ body, contentType, savedAt: new Date().toISOString() }));
}

export async function readApiResponse(input) {
  const key = await keyFor(input);
  const stored = key ? globalThis.localStorage.getItem(key) : null;
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}
