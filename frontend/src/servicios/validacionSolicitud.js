export const SOLICITUD_LIMITS = Object.freeze({
  pesoBultoKg: 9999.99,
  cantidadBultos: 99999,
  pesoTotalKg: 999999.99,
  observacion: 100,
});

export function validatePickupRequest(groups, observation = '') {
  if (!Array.isArray(groups) || !groups.length) {
    return 'Agrega al menos un grupo de bultos.';
  }
  for (const group of groups) {
    if (!Number.isFinite(group.peso_bulto_kg) || group.peso_bulto_kg <= 0) {
      return 'Completa el peso de cada grupo con un valor mayor que cero.';
    }
    if (group.peso_bulto_kg > SOLICITUD_LIMITS.pesoBultoKg) {
      return `El peso por bulto no puede superar ${SOLICITUD_LIMITS.pesoBultoKg} kg.`;
    }
    if (!Number.isInteger(group.cantidad_bultos) || group.cantidad_bultos <= 0) {
      return 'Completa la cantidad de cada grupo con un número entero mayor que cero.';
    }
    if (group.cantidad_bultos > SOLICITUD_LIMITS.cantidadBultos) {
      return `La cantidad por grupo no puede superar ${SOLICITUD_LIMITS.cantidadBultos} bultos.`;
    }
  }
  const total = groups.reduce((sum, group) => sum + group.peso_bulto_kg * group.cantidad_bultos, 0);
  if (!Number.isFinite(total) || total > SOLICITUD_LIMITS.pesoTotalKg) {
    return `El peso total no puede superar ${SOLICITUD_LIMITS.pesoTotalKg} kg.`;
  }
  if (String(observation).trim().length > SOLICITUD_LIMITS.observacion) {
    return `Las observaciones no pueden superar ${SOLICITUD_LIMITS.observacion} caracteres.`;
  }
  return null;
}
