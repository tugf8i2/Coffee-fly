import * as Crypto from 'expo-crypto';

import { API_BASE_URL, fetchApi } from '../config';
import {
  assignLegacyOwner,
  belongsToOwner,
  offlineOwnerId,
  ownedStorageKey,
} from './offlineOwnership';
import { classifySyncFailure, retryDelaySeconds } from './syncPolicy';
import { getAuthenticatedSession } from './trackingSession';

const QUEUE_KEY = 'coffee-fly-sync-queue';
const REJECTED_KEY = 'coffee-fly-sync-rejected';
const LAST_SYNC_KEY = 'coffee-fly-last-sync';
const SYNC_STATE_KEY = 'coffee-fly-sync-state';
const MAX_QUEUE_BYTES = 4 * 1024 * 1024;

const synchronizationPromises = new Map();

async function currentOwnerId(token = null) {
  const session = await getAuthenticatedSession();
  if (token && session?.token !== token) return null;
  return offlineOwnerId(session);
}

async function scopedKey(key, ownerOverride = null) {
  const ownerId = ownerOverride || await currentOwnerId();
  return ownedStorageKey(key, ownerId);
}

function readArray(key) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

const getQueue = () => readArray(QUEUE_KEY);
const putQueue = (items) => window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

function idempotencyKey(tipo, payload) {
  const key = payload.client_point_id || payload.client_request_id;
  return key ? `${tipo}:${key}` : null;
}

function removeQueueItem(id) {
  putQueue(getQueue().filter((item) => item.id !== id));
}

function updateQueueItem(id, changes) {
  putQueue(getQueue().map((item) => (item.id === id ? { ...item, ...changes } : item)));
}

function preserveRejection(item, reason) {
  const rejected = readArray(REJECTED_KEY);
  rejected.push({ ...item, motivo: reason, rechazado_en: new Date().toISOString() });
  window.localStorage.setItem(REJECTED_KEY, JSON.stringify(rejected.slice(-200)));
  removeQueueItem(item.id);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function responseError(response, data, fallback) {
  const error = new Error(data.detail || fallback);
  error.status = response.status;
  return error;
}

export async function estaEnLinea() {
  if (!navigator.onLine) return false;
  try {
    const response = await fetchApi(`${API_BASE_URL}/`, { timeoutMs: 3000 });
    return response.ok;
  } catch {
    return false;
  }
}

export async function encolar(tipo, payload) {
  const ownerId = await currentOwnerId();
  if (!ownerId) throw new Error('Inicia sesión antes de guardar operaciones offline.');
  const list = getQueue();
  const key = idempotencyKey(tipo, payload);
  if (key && list.some((item) => belongsToOwner(item, ownerId) && item.clave_idempotencia === key)) {
    return { inserted: false };
  }
  const item = {
    id: key || Crypto.randomUUID(),
    tipo,
    payload,
    creado_en: new Date().toISOString(),
    intentos: 0,
    proximo_intento: null,
    ultimo_error: null,
    clave_idempotencia: key,
    owner_id: ownerId,
  };
  const serialized = JSON.stringify([...list, item]);
  if (new Blob([serialized]).size > MAX_QUEUE_BYTES) {
    throw new Error('El almacenamiento offline del navegador está lleno. Conéctate para sincronizar.');
  }
  putQueue([...list, item]);
  return { inserted: true };
}

export async function guardarUltimaSincronizacion(ownerOverride = null) {
  const value = new Date().toISOString();
  const key = await scopedKey(LAST_SYNC_KEY, ownerOverride);
  if (!key) throw new Error('Inicia sesión para guardar el estado de sincronización.');
  window.localStorage.setItem(key, value);
  return value;
}

export async function obtenerUltimaSincronizacion() {
  const key = await scopedKey(LAST_SYNC_KEY);
  return key ? window.localStorage.getItem(key) : null;
}

export async function guardarCacheDashboard(data) {
  const key = await scopedKey('coffee-fly-dashboard');
  if (!key) throw new Error('Inicia sesión para guardar datos offline.');
  window.localStorage.setItem(key, JSON.stringify(data));
}

export async function obtenerCacheDashboard() {
  const key = await scopedKey('coffee-fly-dashboard');
  const value = key ? window.localStorage.getItem(key) : null;
  return value ? JSON.parse(value) : null;
}

export async function guardarRutaEntrega(entregaId, ruta) {
  const key = await scopedKey(`coffee-fly-ruta:${entregaId}`);
  if (!key) throw new Error('Inicia sesión para guardar la ruta offline.');
  window.localStorage.setItem(key, JSON.stringify(ruta));
}

export async function obtenerRutaEntrega(entregaId) {
  const key = await scopedKey(`coffee-fly-ruta:${entregaId}`);
  const value = key ? window.localStorage.getItem(key) : null;
  return value ? JSON.parse(value) : null;
}

export async function guardarUbicacionFincaLocal(ubicacion) {
  const key = await scopedKey('coffee-fly-ubicacion-finca');
  if (!key) throw new Error('Inicia sesión para guardar la ubicación offline.');
  window.localStorage.setItem(key, JSON.stringify(ubicacion));
}

export async function obtenerUbicacionFincaLocal() {
  const key = await scopedKey('coffee-fly-ubicacion-finca');
  const value = key ? window.localStorage.getItem(key) : null;
  return value ? JSON.parse(value) : null;
}

async function enviar(tipo, payload, token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  let response;
  let fallback;
  if (tipo === 'ubicacion_finca') {
    response = await fetchApi(`${API_BASE_URL}/usuarios/mi-ubicacion`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ latitud: payload.latitud, longitud: payload.longitud }),
    });
    fallback = 'No fue posible sincronizar la ubicación de la finca';
  } else if (tipo === 'solicitud') {
    response = await fetchApi(`${API_BASE_URL}/solicitudes/sincronizar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_request_id: payload.client_request_id,
        peso_kg: payload.kg,
        observacion: payload.observacion || '',
        capturada_en: payload.fecha,
      }),
    });
    fallback = 'No fue posible sincronizar la solicitud';
  } else {
    response = await fetchApi(`${API_BASE_URL}/entregas/${payload.entrega_id}/estado`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ estado_entrega: payload.estado_entrega, modificado_en: payload.fecha }),
    });
    fallback = 'No fue posible sincronizar el estado';
  }
  const data = await readJson(response);
  if (!response.ok) throw responseError(response, data, fallback);
  return data;
}

function migrateQueue(ownerId) {
  const migrated = assignLegacyOwner(getQueue(), ownerId).map((item) => {
    let payload = item.payload;
    if (item.tipo === 'solicitud' && !payload.client_request_id) {
      payload = { ...payload, client_request_id: Crypto.randomUUID() };
    }
    const key = idempotencyKey(item.tipo, payload);
    return {
      ...item,
      id: item.id || key || Crypto.randomUUID(),
      payload,
      intentos: Number(item.intentos || 0),
      proximo_intento: item.proximo_intento || null,
      ultimo_error: item.ultimo_error || null,
      clave_idempotencia: item.clave_idempotencia || key,
      owner_id: item.owner_id,
    };
  });
  putQueue(migrated);
  return migrated;
}

async function synchronize(token, ownerId) {
  const queued = migrateQueue(ownerId).filter((item) => belongsToOwner(item, ownerId));
  if (!navigator.onLine) return { sincronizadas: 0, conflictos: 0, descartadas: 0, pendientes: queued.length, estado: 'offline' };

  const now = Date.now();
  const due = queued
    .filter((item) => !item.proximo_intento || Date.parse(item.proximo_intento) <= now)
    .sort((a, b) => Date.parse(a.creado_en) - Date.parse(b.creado_en));
  let sincronizadas = 0;
  let conflictos = 0;
  let descartadas = 0;
  let estado = 'synced';
  let ultimoError = null;

  for (const item of due) {
    try {
      await enviar(item.tipo, item.payload, token);
      removeQueueItem(item.id);
      sincronizadas += 1;
    } catch (error) {
      ultimoError = error.message;
      const action = classifySyncFailure(item.tipo, error.status, error instanceof SyntaxError);
      if (action === 'reject') {
        preserveRejection(item, error instanceof SyntaxError ? 'Payload local corrupto' : error.message);
        descartadas += 1;
        continue;
      }
      if (action === 'conflict') {
        removeQueueItem(item.id);
        conflictos += 1;
        continue;
      }
      if (action === 'auth_required') {
        updateQueueItem(item.id, { ultimo_error: error.message });
        estado = 'auth_required';
        break;
      }
      const attempts = Number(item.intentos || 0) + 1;
      updateQueueItem(item.id, {
        intentos: attempts,
        proximo_intento: new Date(Date.now() + retryDelaySeconds(attempts) * 1000).toISOString(),
        ultimo_error: error.message,
      });
      estado = 'pending';
      break;
    }
  }

  if (sincronizadas) await guardarUltimaSincronizacion(ownerId);
  const pendientes = getQueue().filter((item) => belongsToOwner(item, ownerId)).length;
  if (estado === 'synced' && pendientes) estado = 'pending';
  const result = { sincronizadas, conflictos, descartadas, pendientes, pendiente: pendientes > 0, estado, ultimoError };
  window.localStorage.setItem(
    ownedStorageKey(SYNC_STATE_KEY, ownerId),
    JSON.stringify({ ...result, actualizadoEn: new Date().toISOString() }),
  );
  return result;
}

export async function sincronizarPendientes(token) {
  const ownerId = await currentOwnerId(token);
  if (!ownerId) {
    return { sincronizadas: 0, conflictos: 0, descartadas: 0, pendientes: 0, estado: 'auth_required' };
  }
  if (!synchronizationPromises.has(ownerId)) {
    const promise = synchronize(token, ownerId)
      .finally(() => synchronizationPromises.delete(ownerId));
    synchronizationPromises.set(ownerId, promise);
  }
  return synchronizationPromises.get(ownerId);
}

export async function enviarOSolicitarEnCola(tipo, payload, token) {
  if (!navigator.onLine) {
    await encolar(tipo, payload);
    return { offline: true };
  }
  try {
    const data = await enviar(tipo, payload, token);
    await guardarUltimaSincronizacion();
    return { offline: false, data };
  } catch (error) {
    const action = classifySyncFailure(tipo, error.status, error instanceof SyntaxError);
    if (action !== 'retry') throw error;
    await encolar(tipo, payload);
    return { offline: true, error };
  }
}

export function observarConexion(token, onSync, onConnectionChange) {
  let stopped = false;
  let checkPromise = null;
  const check = () => {
    if (checkPromise) return checkPromise;
    checkPromise = (async () => {
      if (!navigator.onLine) {
        onConnectionChange?.('offline');
        onSync?.({ estado: 'offline' });
        return;
      }
      const apiReachable = await estaEnLinea();
      if (stopped) return;
      onConnectionChange?.(apiReachable ? 'online' : 'server_unreachable');
      if (!apiReachable) {
        onSync?.({ estado: 'offline' });
      } else if (token) {
        sincronizarPendientes(token)
          .then((result) => !stopped && onSync?.(result))
          .catch((error) => !stopped && onSync?.({ estado: 'pending', ultimoError: error.message }));
      }
    })().finally(() => { checkPromise = null; });
    return checkPromise;
  };
  window.addEventListener('online', check);
  window.addEventListener('offline', check);
  const timer = setInterval(check, 60000);
  check();
  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener('online', check);
    window.removeEventListener('offline', check);
  };
}
