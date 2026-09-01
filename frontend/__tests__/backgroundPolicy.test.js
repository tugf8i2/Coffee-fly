import { isPowerConserving, trackingIntervals } from '../src/services/backgroundPolicy';

describe('política de batería para GPS', () => {
  test('usa el perfil normal con batería suficiente', () => {
    const profile = trackingIntervals({ batteryLevel: 0.8, lowPowerMode: false });
    expect(profile).toMatchObject({
      conserving: false,
      timeInterval: 15000,
      distanceInterval: 10,
    });
  });

  test('reduce frecuencia con batería igual o inferior al 20 %', () => {
    const profile = trackingIntervals({ batteryLevel: 0.2, lowPowerMode: false });
    expect(profile).toMatchObject({
      conserving: true,
      timeInterval: 30000,
      distanceInterval: 25,
      deferredUpdatesInterval: 60000,
    });
  });

  test('respeta el modo de ahorro aunque no se conozca el nivel', () => {
    expect(isPowerConserving({ batteryLevel: -1, lowPowerMode: true })).toBe(true);
  });
});
