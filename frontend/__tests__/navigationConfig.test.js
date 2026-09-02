const fs = require('fs');
const path = require('path');

const {
  APP_SCREEN_KEYS,
  ROLE_CARDS,
  findNavigationErrors,
  navigationTargets,
} = require('../src/navigationConfig');

describe('navegación por roles', () => {
  test('cada acceso visible apunta a una pantalla registrada', () => {
    expect(findNavigationErrors(APP_SCREEN_KEYS)).toEqual([]);
  });

  test('no repite módulos dentro de un mismo rol', () => {
    Object.entries(ROLE_CARDS).forEach(([role, cards]) => {
      const targets = cards.map(([, screen]) => screen);
      expect(new Set(targets).size).toBe(targets.length);
      expect(cards.length).toBeGreaterThan(0);
      expect(role).toMatch(/^(caficultor|registrador|coordinador|conductor)$/);
    });
  });

  test('conserva los módulos originales y los operativos agregados', () => {
    expect(navigationTargets()).toEqual(expect.arrayContaining([
      'request',
      'farmerDashboard',
      'tracking',
      'users',
      'cooperatives',
      'requests',
      'vehicles',
      'deliveries',
      'vehicleAssignment',
      'reports',
      'monitoring',
    ]));
  });

  test('FullApp implementa todas las pantallas declaradas', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'FullApp.js'), 'utf8');
    APP_SCREEN_KEYS.forEach((screen) => {
      expect(source).toMatch(new RegExp(`\\b${screen}\\s*:`));
    });
  });
});
