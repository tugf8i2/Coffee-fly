import { driverDate } from '../conductor/presentacionConductor';

export function coordinatorRows(requests, deliveries) {
  const registered = new Set(
    deliveries.map((item) => String(item.solicitud_id)),
  );
  return [
    ...requests
      .filter((item) => !registered.has(String(item.id_solicitud)))
      .map((item) => ({
        ...item,
        id: item.id_solicitud,
        date: item.fecha_hora_solicitud,
        farmer: item.caficultor_nombre,
        kg: item.cantidad_solicitada_kg,
        status: 'Pendiente',
        registered: false,
      })),
    ...deliveries.map((item) => ({
      ...item,
      id: item.id_entrega,
      date: item.fecha_hora_entrega,
      farmer: item.caficultor_nombre,
      kg: item.cantidad_kg,
      registered: true,
      status:
        item.estado_entrega === 'en camino'
          ? 'En transporte'
          : item.estado_entrega === 'entregado'
            ? 'Completada'
            : item.estado_entrega === 'cancelado'
              ? 'Cancelada'
              : item.vehiculo_placa
                ? 'Asignada'
                : 'En asignación',
    })),
  ].sort(
    (a, b) =>
      (driverDate(b.date)?.getTime() || 0) -
      (driverDate(a.date)?.getTime() || 0),
  );
}
export function searchCoordinatorRows(rows, search, status = 'Todas') {
  const normalize = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const query = normalize(search).trim();
  return rows.filter(
    (item) =>
      (status === 'Todas' || item.status === status) &&
      normalize(
        [item.id, item.farmer, item.vehiculo_placa, item.observaciones].join(
          ' ',
        ),
      ).includes(query),
  );
}
