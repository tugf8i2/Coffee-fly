import { erroresFormularioVehiculo } from '../src/modulos/vehiculos/GestionVehiculos';

const catalog = [{ codigo: 'C2', clase_vehiculo: 'rigido', pbv_maximo_legal_kg: 17000 }];
const valid = {
  placa: 'ABC123', tipo_vehiculo: 'Camión', marca: 'Chevrolet', modelo_comercial: 'NPR', modelo: '2024',
  configuracion: 'C2', tara_kg: '6300', pbv_homologado_kg: '17000',
  soat_vencimiento: '2027-09-22', tecnomecanica_vencimiento: '2027-09-22', seguro_vencimiento: '2027-09-22',
};

test('acepta un vehículo completo y coherente', () => {
  expect(erroresFormularioVehiculo(valid, catalog)).toEqual([]);
});

test('detalla todos los campos faltantes en un solo intento', () => {
  const errors = erroresFormularioVehiculo({ ...valid, placa: '', marca: '', tara_kg: '', soat_vencimiento: '' }, catalog);
  expect(errors).toEqual(expect.arrayContaining([
    'Placa: es obligatoria.', 'Marca: es obligatoria.', 'Tara: es obligatoria.', 'SOAT: selecciona la fecha de vencimiento.',
  ]));
});

test('explica incompatibilidad de configuración y pesos', () => {
  const errors = erroresFormularioVehiculo({ ...valid, tipo_vehiculo: 'Van', tara_kg: '18000', pbv_homologado_kg: '19000' }, catalog);
  expect(errors.join(' ')).toContain('no corresponde a un vehículo tipo Van');
  expect(errors.join(' ')).toContain('PBV máximo legal');
});
