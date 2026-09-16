export function fechaLocal(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validarPeriodo(desde, hasta) {
  const valid = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(desde) || !valid(hasta)) return 'Escribe ambas fechas válidas en formato AAAA-MM-DD.';
  const days = (Date.parse(hasta) - Date.parse(desde)) / 86400000;
  if (days < 0) return 'La fecha final no puede ser anterior a la inicial.';
  if (days >= 30) return 'Selecciona un período de máximo 30 días, incluyendo ambas fechas.';
  return '';
}
export function queryPeriodo(periodo) {
  return new URLSearchParams({ fecha_desde: periodo.desde, fecha_hasta: periodo.hasta }).toString();
}
