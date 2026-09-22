import {
  coordinatorRows,
  includeActiveDeliveries,
  searchCoordinatorRows,
} from '../src/modulos/coordinador/presentacionCoordinador';

const request = {
  id_solicitud: 'request-1',
  caficultor_nombre: 'Juan Pérez',
  cantidad_solicitada_kg: 300,
  fecha_hora_solicitud: '2026-09-16T12:00:00Z',
};
const delivery = {
  id_entrega: 'delivery-1',
  solicitud_id: 'request-1',
  caficultor_nombre: 'Juan Pérez',
  cantidad_kg: 300,
  fecha_hora_entrega: '2026-09-16T13:00:00Z',
  estado_entrega: 'pendiente',
};
describe('panel del coordinador', () => {
  test('no duplica una solicitud ya recolectada', () => {
    expect(coordinatorRows([request], [delivery])).toHaveLength(1);
    expect(coordinatorRows([request], [delivery])[0]).toMatchObject({
      id: 'delivery-1',
      registered: true,
      kg: 300,
      status: 'En asignación',
    });
  });
  test.each([
    ['pendiente', null, 'En asignación'],
    ['pendiente', 'ABC-123', 'Asignada'],
    ['en camino', 'ABC-123', 'En transporte'],
    ['entregado', 'ABC-123', 'Completada'],
    ['cancelado', null, 'Cancelada'],
  ])('mapea estado real %s con placa %s', (state, plate, status) => {
    expect(
      coordinatorRows(
        [],
        [{ ...delivery, estado_entrega: state, vehiculo_placa: plate }],
      )[0].status,
    ).toBe(status);
  });
  test('la búsqueda no depende de tildes ni mayúsculas', () => {
    const rows = coordinatorRows([request], []);
    expect(searchCoordinatorRows(rows, 'PEREZ', 'Pendiente')).toHaveLength(1);
    expect(searchCoordinatorRows(rows, 'PEREZ', 'Completada')).toHaveLength(0);
  });
  test('ordena solicitudes y recolecciones por fecha descendente', () => {
    expect(
      coordinatorRows(
        [{ ...request, id_solicitud: 'request-2' }],
        [delivery],
      ).map((item) => item.id),
    ).toEqual(['delivery-1', 'request-2']);
    expect(coordinatorRows([], [])).toEqual([]);
  });
  test('mantiene visible una carga en camino aunque no esté en la página actual', () => {
    const active = { ...delivery, id_entrega: 'active-1', estado_entrega: 'en camino' };
    expect(includeActiveDeliveries([delivery], [active])).toEqual([active, delivery]);
    expect(includeActiveDeliveries([active, delivery], [active])).toEqual([active, delivery]);
    expect(coordinatorRows([], includeActiveDeliveries([delivery], [active]))
      .some((item) => item.id === 'active-1' && item.status === 'En transporte')).toBe(true);
  });
});
