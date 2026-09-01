import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { API_BASE_URL, fetchApi } from '../config';
import {
  decryptOfflineText,
  encryptOfflineText,
  ensureEncryptedOfflineText,
  isEncryptedOfflineText,
} from './offlineCrypto';
import { offlineOwnerId, ownedStorageKey } from './offlineOwnership';
import { classifySyncFailure, retryDelaySeconds } from './syncPolicy';
import { getAuthenticatedSession } from './trackingSession';

let databasePromise;
const synchronizationPromises = new Map();
const MAX_QUEUE_BYTES = 50 * 1024 * 1024;

async function addMissingQueueColumns(db) {
  const columns = await db.getAllAsync('PRAGMA table_info(sync_queue)');
  const names = new Set(columns.map((column) => column.name));
  const additions = [
    ['intentos', 'INTEGER NOT NULL DEFAULT 0'],
    ['proximo_intento', 'TEXT'],
    ['ultimo_error', 'TEXT'],
    ['clave_idempotencia', 'TEXT'],
    ['owner_id', 'TEXT'],
  ];
  for (const [name, definition] of additions) {
    if (!names.has(name)) await db.execAsync(`ALTER TABLE sync_queue ADD COLUMN ${name} ${definition}`);
  }
  await db.execAsync(`
    DROP INDEX IF EXISTS ux_sync_queue_idempotencia;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_sync_queue_owner_idempotencia
      ON sync_queue (owner_id, clave_idempotencia)
      WHERE clave_idempotencia IS NOT NULL;
  `);
}

async function addMissingRejectedColumns(db) {
  const columns = await db.getAllAsync('PRAGMA table_info(sync_rejected)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('owner_id')) await db.execAsync('ALTER TABLE sync_rejected ADD COLUMN owner_id TEXT');
}

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('coffee-fly-offline.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo TEXT NOT NULL,
          payload TEXT NOT NULL,
          creado_en TEXT NOT NULL,
          intentos INTEGER NOT NULL DEFAULT 0,
          proximo_intento TEXT,
          ultimo_error TEXT,
          clave_idempotencia TEXT,
          owner_id TEXT
        );
        CREATE TABLE IF NOT EXISTS sync_rejected (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo TEXT NOT NULL,
          payload TEXT NOT NULL,
          motivo TEXT NOT NULL,
          rechazado_en TEXT NOT NULL,
          owner_id TEXT
        );
        CREATE TABLE IF NOT EXISTS sync_state (
          clave TEXT PRIMARY KEY,
          valor TEXT NOT NULL
        );
      `);
      await addMissingQueueColumns(db);
      await addMissingRejectedColumns(db);
      return db;
    });
  }
  return databasePromise;
}

async function currentOwnerId(token = null) {
  const session = await getAuthenticatedSession();
  if (token && session?.token !== token) return null;
  return offlineOwnerId(session);
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

async function saveState(key, value, ownerOverride = null) {
  const ownerId = ownerOverride || await currentOwnerId();
  const storageKey = ownedStorageKey(key, ownerId);
  if (!storageKey) throw new Error('Inicia sesión para guardar datos offline.');
  const db = await database();
  const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_state (clave, valor) VALUES (?, ?)',
    [storageKey, await encryptOfflineText(plaintext)],
  );
}

async function readState(key) {
  const ownerId = await currentOwnerId();
  const storageKey = ownedStorageKey(key, ownerId);
  if (!storageKey) return null;
  const db = await database();
  const row = await db.getFirstAsync('SELECT valor FROM sync_state WHERE clave = ?', [storageKey]);
  if (!row) return null;
  const plaintext = await decryptOfflineText(row.valor);
  if (!isEncryptedOfflineText(row.valor)) {
    await db.runAsync('UPDATE sync_state SET valor = ? WHERE clave = ?', [await encryptOfflineText(plaintext), storageKey]);
  }
  return { valor: plaintext };
}

// Se verifica la API real con timeout. Tener Wi-Fi no significa que FastAPI sea
// alcanzable, especialmente cuando el teléfono usa un túnel temporal.
export async function estaEnLinea() {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetchApi(`${API_BASE_URL}/`, { signal: controller.signal, timeoutMs: 3000 });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function encolar(tipo, payload) {
  const ownerId = await currentOwnerId();
  if (!ownerId) throw new Error('Inicia sesión antes de guardar operaciones offline.');
  const db = await database();
  const contenido = await encryptOfflineText(JSON.stringify(payload));
  const total = await db.getFirstAsync('SELECT COALESCE(SUM(LENGTH(payload)), 0) AS bytes FROM sync_queue');
  if ((total?.bytes || 0) + contenido.length > MAX_QUEUE_BYTES) {
    throw new Error('El almacenamiento offline alcanzó el límite de 50 MB. Conéctate para sincronizar.');
  }
  const idempotencyKey = tipo === 'ubicacion_gps'
    ? payload.client_point_id
    : tipo === 'solicitud' ? payload.client_request_id : null;
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO sync_queue
      (tipo, payload, creado_en, intentos, proximo_intento, ultimo_error, clave_idempotencia, owner_id)
      VALUES (?, ?, ?, 0, NULL, NULL, ?, ?)`,
    [tipo, contenido, new Date().toISOString(), idempotencyKey, ownerId],
  );
  return { inserted: result.changes > 0, id: result.lastInsertRowId };
}

export async function guardarUltimaSincronizacion(ownerId = null) {
  const fecha = new Date().toISOString();
  await saveState('ultima_sincronizacion', fecha, ownerId);
  return fecha;
}

export async function obtenerUltimaSincronizacion() {
  const value = await readState('ultima_sincronizacion');
  return value?.valor || null;
}

export function guardarCacheDashboard(data) {
  return saveState('dashboard', data);
}

export async function obtenerCacheDashboard() {
  const value = await readState('dashboard');
  return value?.valor ? JSON.parse(value.valor) : null;
}

export function guardarRutaEntrega(entregaId, ruta) {
  return saveState(`ruta:${entregaId}`, ruta);
}

export async function obtenerRutaEntrega(entregaId) {
  const value = await readState(`ruta:${entregaId}`);
  return value?.valor ? JSON.parse(value.valor) : null;
}

export function guardarUbicacionFincaLocal(ubicacion) {
  return saveState('ubicacion_finca', ubicacion);
}

export async function obtenerUbicacionFincaLocal() {
  const value = await readState('ubicacion_finca');
  return value?.valor ? JSON.parse(value.valor) : null;
}

export function guardarUltimoPuntoGps(entregaId, punto) {
  return saveState(`gps_ultimo:${entregaId}`, punto);
}

export async function obtenerUltimoPuntoGps(entregaId) {
  const value = await readState(`gps_ultimo:${entregaId}`);
  return value?.valor ? JSON.parse(value.valor) : null;
}

export function guardarEstadoRastreo(value) {
  return saveState('estado_rastreo_gps', { ...value, actualizadoEn: new Date().toISOString() });
}

export async function obtenerEstadoRastreo() {
  const value = await readState('estado_rastreo_gps');
  return value?.valor ? JSON.parse(value.valor) : null;
}

async function enviarOperacion(tipo, payload, token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (tipo === 'ubicacion_gps') {
    const { entrega_id: entregaId, ...punto } = payload;
    const response = await fetchApi(`${API_BASE_URL}/entregas/${entregaId}/ubicacion`, {
      method: 'POST', headers, body: JSON.stringify(punto),
    });
    const data = await readJson(response);
    if (!response.ok) throw responseError(response, data, 'No fue posible sincronizar el punto GPS');
    return data;
  }
  if (tipo === 'ubicacion_finca') {
    const response = await fetchApi(`${API_BASE_URL}/usuarios/mi-ubicacion`, {
      method: 'PUT', headers, body: JSON.stringify({ latitud: payload.latitud, longitud: payload.longitud }),
    });
    const data = await readJson(response);
    if (!response.ok) throw responseError(response, data, 'No fue posible sincronizar la ubicación de la finca');
    return data;
  }
  if (tipo === 'solicitud') {
    const solicitud = await fetchApi(`${API_BASE_URL}/solicitudes/sincronizar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_request_id: payload.client_request_id,
        peso_kg: payload.kg,
        observacion: payload.observacion || '',
        capturada_en: payload.fecha,
      }),
    });
    const solicitudData = await readJson(solicitud);
    if (!solicitud.ok) throw responseError(solicitud, solicitudData, 'No fue posible sincronizar la solicitud');
    return solicitudData;
  }
  const response = await fetchApi(`${API_BASE_URL}/entregas/${payload.entrega_id}/estado`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ estado_entrega: payload.estado_entrega, modificado_en: payload.fecha }),
  });
  const data = await readJson(response);
  if (!response.ok) throw responseError(response, data, 'No fue posible sincronizar el estado');
  return data;
}

async function enviarLoteGps(deliveryId, items, token) {
  const puntos = items.map(({ payload }) => {
    const { entrega_id: _deliveryId, ...point } = payload;
    return point;
  });
  const response = await fetchApi(`${API_BASE_URL}/entregas/${deliveryId}/ubicaciones/sincronizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ puntos }),
  });
  const data = await readJson(response);
  if (!response.ok) throw responseError(response, data, 'No fue posible sincronizar el lote GPS');
  return data;
}

async function conservarRechazo(db, operacion, error) {
  const protectedPayload = await ensureEncryptedOfflineText(operacion.payload);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO sync_rejected (tipo, payload, motivo, rechazado_en, owner_id) VALUES (?, ?, ?, ?, ?)',
      [operacion.tipo, protectedPayload, error.message, new Date().toISOString(), operacion.owner_id],
    );
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [operacion.id]);
  });
}

async function scheduleRetry(db, operation, error) {
  const attempts = Number(operation.intentos || 0) + 1;
  const delaySeconds = retryDelaySeconds(attempts);
  const nextAttempt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  await db.runAsync(
    'UPDATE sync_queue SET intentos = ?, proximo_intento = ?, ultimo_error = ? WHERE id = ?',
    [attempts, nextAttempt, error.message || 'Error de sincronización', operation.id],
  );
  return nextAttempt;
}

async function pendingCounts(db, ownerId) {
  if (!ownerId) return { pendientes: 0, gpsPendientes: 0, rechazadas: 0 };
  const pending = await db.getFirstAsync('SELECT COUNT(*) AS total FROM sync_queue WHERE owner_id = ?', [ownerId]);
  const gps = await db.getFirstAsync("SELECT COUNT(*) AS total FROM sync_queue WHERE owner_id = ? AND tipo = 'ubicacion_gps'", [ownerId]);
  const rejected = await db.getFirstAsync('SELECT COUNT(*) AS total FROM sync_rejected WHERE owner_id = ?', [ownerId]);
  return {
    pendientes: Number(pending?.total || 0),
    gpsPendientes: Number(gps?.total || 0),
    rechazadas: Number(rejected?.total || 0),
  };
}

async function claimLegacyQueue(db, ownerId) {
  const owned = await db.getFirstAsync('SELECT COUNT(*) AS total FROM sync_queue WHERE owner_id IS NOT NULL');
  if (Number(owned?.total || 0) === 0) {
    await db.runAsync('UPDATE sync_queue SET owner_id = ? WHERE owner_id IS NULL', [ownerId]);
    await db.runAsync('UPDATE sync_rejected SET owner_id = ? WHERE owner_id IS NULL', [ownerId]);
  }
}

async function synchronize(token, ownerId) {
  const db = await database();
  await claimLegacyQueue(db, ownerId);
  const before = await pendingCounts(db, ownerId);
  if (!(await estaEnLinea())) return { ...before, sincronizadas: 0, duplicados: 0, conflictos: 0, descartadas: 0, estado: 'offline' };

  const now = new Date().toISOString();
  const operations = await db.getAllAsync(
    `SELECT id, tipo, payload, intentos, owner_id FROM sync_queue
      WHERE owner_id = ? AND (proximo_intento IS NULL OR proximo_intento <= ?)
      ORDER BY id ASC`,
    [ownerId, now],
  );
  let sincronizadas = 0;
  let conflictos = 0;
  let duplicados = 0;
  let descartadas = 0;
  let authRequired = false;
  let lastError = null;
  let position = 0;
  while (position < operations.length) {
    const operation = operations[position];
    let activeBatch = null;
    try {
      const plaintext = await decryptOfflineText(operation.payload);
      const payload = JSON.parse(plaintext);
      if (!isEncryptedOfflineText(operation.payload)) {
        operation.payload = await encryptOfflineText(plaintext);
        await db.runAsync('UPDATE sync_queue SET payload = ? WHERE id = ?', [operation.payload, operation.id]);
      }
      if (operation.tipo === 'solicitud' && !payload.client_request_id) {
        payload.client_request_id = Crypto.randomUUID();
        operation.payload = await encryptOfflineText(JSON.stringify(payload));
        await db.runAsync(
          'UPDATE sync_queue SET payload = ?, clave_idempotencia = ? WHERE id = ?',
          [operation.payload, payload.client_request_id, operation.id],
        );
      }
      if (operation.tipo === 'ubicacion_gps') {
        const batch = [{ operation, payload }];
        let nextPosition = position + 1;
        while (nextPosition < operations.length && batch.length < 100) {
          const candidate = operations[nextPosition];
          if (candidate.tipo !== 'ubicacion_gps') break;
          try {
            const candidatePlaintext = await decryptOfflineText(candidate.payload);
            const candidatePayload = JSON.parse(candidatePlaintext);
            if (!isEncryptedOfflineText(candidate.payload)) {
              candidate.payload = await encryptOfflineText(candidatePlaintext);
              await db.runAsync(
                'UPDATE sync_queue SET payload = ? WHERE id = ?',
                [candidate.payload, candidate.id],
              );
            }
            if (candidatePayload.entrega_id !== payload.entrega_id) break;
            batch.push({ operation: candidate, payload: candidatePayload });
            nextPosition += 1;
          } catch {
            break;
          }
        }
        activeBatch = batch;
        const response = await enviarLoteGps(payload.entrega_id, batch, token);
        activeBatch = null;
        const byClientId = new Map(
          (response.resultados || []).map((item) => [String(item.client_point_id), item]),
        );
        let incomplete = false;
        for (const item of batch) {
          const result = byClientId.get(String(item.payload.client_point_id));
          if (!result) {
            await scheduleRetry(db, item.operation, new Error('El servidor no confirmó este punto GPS'));
            incomplete = true;
            continue;
          }
          if (result.estado === 'rechazado') {
            await conservarRechazo(db, item.operation, new Error(result.detalle || 'Punto GPS rechazado'));
            descartadas += 1;
          } else {
            await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.operation.id]);
            if (result.estado === 'duplicado') duplicados += 1;
            else sincronizadas += 1;
          }
        }
        if (incomplete) break;
        position = nextPosition;
        continue;
      }
      await enviarOperacion(operation.tipo, payload, token);
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [operation.id]);
      sincronizadas += 1;
    } catch (error) {
      lastError = error.message;
      const action = classifySyncFailure(operation.tipo, error.status, error instanceof SyntaxError);
      const affected = activeBatch?.map((item) => item.operation) || [operation];
      if (action === 'reject') {
        const rejection = error instanceof SyntaxError ? new Error('Payload local corrupto') : error;
        for (const item of affected) await conservarRechazo(db, item, rejection);
        descartadas += affected.length;
        position += affected.length;
        continue;
      }
      if (action === 'auth_required') {
        authRequired = true;
        for (const item of affected) {
          await db.runAsync('UPDATE sync_queue SET ultimo_error = ? WHERE id = ?', [error.message, item.id]);
        }
        break;
      }
      if (action === 'conflict') {
        for (const item of affected) await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
        conflictos += affected.length;
        position += affected.length;
        continue;
      }
      for (const item of affected) await scheduleRetry(db, item, error);
      break;
    }
    position += 1;
  }
  if (sincronizadas || duplicados) await guardarUltimaSincronizacion(ownerId);
  const after = await pendingCounts(db, ownerId);
  const estado = authRequired ? 'auth_required' : after.pendientes ? 'pending' : 'synced';
  const result = { ...after, sincronizadas, duplicados, conflictos, descartadas, estado, ultimoError: lastError };
  await saveState('estado_sincronizacion', { ...result, actualizadoEn: new Date().toISOString() }, ownerId);
  return result;
}

export async function sincronizarPendientes(token) {
  const ownerId = await currentOwnerId(token);
  if (!ownerId) {
    return { pendientes: 0, gpsPendientes: 0, rechazadas: 0, sincronizadas: 0, duplicados: 0, conflictos: 0, descartadas: 0, estado: 'auth_required' };
  }
  if (!synchronizationPromises.has(ownerId)) {
    const promise = synchronize(token, ownerId)
      .finally(() => synchronizationPromises.delete(ownerId));
    synchronizationPromises.set(ownerId, promise);
  }
  return synchronizationPromises.get(ownerId);
}

export async function registrarPuntoGpsOfflineFirst(payload, token, { synchronizeNow = true } = {}) {
  const queued = await encolar('ubicacion_gps', payload);
  await guardarUltimoPuntoGps(payload.entrega_id, payload);
  if (!synchronizeNow) return { offline: true, queued: queued.inserted, estado: 'pending' };
  const result = await sincronizarPendientes(token);
  return {
    ...result,
    queued: queued.inserted,
    offline: result.estado !== 'synced',
  };
}

export async function obtenerEstadoSincronizacion() {
  const db = await database();
  const counts = await pendingCounts(db, await currentOwnerId());
  const lastSync = await obtenerUltimaSincronizacion();
  const saved = await readState('estado_sincronizacion');
  return {
    ...(saved?.valor ? JSON.parse(saved.valor) : {}),
    ...counts,
    ultimaSincronizacion: lastSync,
  };
}

export async function enviarOSolicitarEnCola(tipo, payload, token) {
  if (tipo === 'ubicacion_gps') return registrarPuntoGpsOfflineFirst(payload, token);
  if (!(await estaEnLinea())) {
    await encolar(tipo, payload);
    return { offline: true };
  }
  try {
    const data = await enviarOperacion(tipo, payload, token);
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
      try {
        const network = await NetInfo.fetch();
        if (stopped) return;
        if (!network.isConnected) {
          onConnectionChange?.('offline');
          onSync?.({ estado: 'offline' });
          return;
        }
        const apiReachable = await estaEnLinea();
        if (stopped) return;
        onConnectionChange?.(apiReachable ? 'online' : 'server_unreachable');
        if (!apiReachable) {
          onSync?.({ estado: 'offline' });
          return;
        }
        if (token) {
          sincronizarPendientes(token)
            .then((result) => !stopped && onSync?.(result))
            .catch((error) => !stopped && onSync?.({ estado: 'pending', ultimoError: error.message }));
        }
      } catch (error) {
        if (!stopped) {
          onConnectionChange?.('server_unreachable');
          onSync?.({ estado: 'offline', ultimoError: error.message });
        }
      }
    })().finally(() => { checkPromise = null; });
    return checkPromise;
  };
  const unsubscribe = NetInfo.addEventListener(check);
  const timer = setInterval(check, 60000);
  check();
  return () => {
    stopped = true;
    clearInterval(timer);
    unsubscribe();
  };
}
