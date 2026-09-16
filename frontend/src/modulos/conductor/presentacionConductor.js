// PostgreSQL almacena las fechas heredadas como UTC sin zona horaria.
export function driverDate(value) {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function driverTodayMetrics(active, history, now = new Date()) {
  const today = now.toLocaleDateString('sv-SE');
  const trips = [...history, ...(active ? [active] : [])];
  const started = trips.filter(
    (trip) =>
      driverDate(trip.iniciado_en)?.toLocaleDateString('sv-SE') === today,
  );
  const completed = trips.filter(
    (trip) =>
      trip.estado_viaje === 'completado' &&
      driverDate(trip.completado_en)?.toLocaleDateString('sv-SE') === today,
  );
  return {
    trips: started.length,
    deliveries: completed.reduce((sum, trip) => sum + trip.cargas.length, 0),
    // Es distancia de viajes de hoy, no un odómetro que invente tramos fuera del seguimiento.
    km:
      started.reduce(
        (sum, trip) => sum + Number(trip.distancia_recorrida_m || 0),
        0,
      ) / 1000,
  };
}
