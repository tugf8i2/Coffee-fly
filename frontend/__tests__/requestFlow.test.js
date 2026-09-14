import { apiErrorMessage } from '../src/servicios/mensajesApi';
import { SOLICITUD_LIMITS, validatePickupRequest } from '../src/servicios/validacionSolicitud';

describe('flujo de solicitudes', () => {
  test('respeta los máximos del schema de sincronización', () => {
    expect(validatePickupRequest([{ peso_bulto_kg: 60, cantidad_bultos: 10 }], 'Café seco')).toBeNull();
    expect(validatePickupRequest([{ peso_bulto_kg: SOLICITUD_LIMITS.pesoBultoKg + 0.01, cantidad_bultos: 1 }])).toMatch(/peso por bulto/i);
    expect(validatePickupRequest([{ peso_bulto_kg: 1, cantidad_bultos: SOLICITUD_LIMITS.cantidadBultos + 1 }])).toMatch(/cantidad por grupo/i);
    expect(validatePickupRequest([{ peso_bulto_kg: 9999.99, cantidad_bultos: 101 }])).toMatch(/peso total/i);
    expect(validatePickupRequest([{ peso_bulto_kg: 1, cantidad_bultos: 1 }], 'x'.repeat(101))).toMatch(/observaciones/i);
  });

  test('presenta detalles estructurados de FastAPI sin convertirlos en object Object', () => {
    const payload = { detail: [
      { loc: ['body', 'grupos_bultos', 0, 'cantidad_bultos'], msg: 'Input should be less than or equal to 99999' },
      { loc: ['body', 'observacion'], msg: 'String should have at most 100 characters' },
    ] };
    expect(apiErrorMessage(payload, 'Error')).toBe(
      'grupos_bultos.0.cantidad_bultos: Input should be less than or equal to 99999\nobservacion: String should have at most 100 characters',
    );
  });
});
