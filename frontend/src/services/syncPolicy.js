export const MAX_RETRY_SECONDS = 15 * 60;

export function retryDelaySeconds(attemptNumber) {
  const safeAttempt = Math.max(1, Number(attemptNumber) || 1);
  return Math.min(MAX_RETRY_SECONDS, 5 * (2 ** Math.min(safeAttempt - 1, 10)));
}

export function classifySyncFailure(operationType, status, corruptPayload = false) {
  if (corruptPayload) return 'reject';
  if (status === 401) return 'auth_required';
  if (status === 409) return 'conflict';
  // Estos códigos describen una operación inválida o no autorizada de forma
  // permanente. Reintentarlos no recupera la conexión y solo atasca la cola.
  // 408, 425, 429 y 5xx sí permanecen como reintentables.
  if ([400, 403, 404, 405, 410, 413, 415, 422].includes(status)) return 'reject';
  return 'retry';
}
