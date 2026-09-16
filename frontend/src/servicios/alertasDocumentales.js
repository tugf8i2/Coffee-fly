export function alertaVencimiento(fecha, hoy = new Date()) {
  if (!fecha) return 'Pendiente de registrar';
  const [year, month, day] = String(fecha).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'Fecha inválida';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(hoy);
  const calendar = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const dias = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(calendar.year, calendar.month - 1, calendar.day)) / 86400000);
  if (dias < 0) return 'Vencido';
  if (dias < 7) return 'Vence en menos de 7 días';
  if (dias < 30) return 'Vence en menos de 30 días';
  return 'Vigente';
}
