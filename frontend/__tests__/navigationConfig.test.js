const fs = require('fs');
const path = require('path');

const {
  APP_SCREEN_KEYS,
  ROLE_CARDS,
  findNavigationErrors,
  navigationTargets,
} = require('../src/configuracion/navegacion');

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

  test('conserva los módulos vigentes y elimina solicitudes del coordinador', () => {
    expect(navigationTargets()).toEqual(expect.arrayContaining([
      'request',
      'farmerDashboard',
      'tracking',
      'users',
      'cooperatives',
      'vehicles',
      'deliveries',
      'vehicleAssignment',
      'reports',
      'monitoring',
    ]));
    expect(ROLE_CARDS.coordinador).not.toEqual(expect.arrayContaining([
      expect.arrayContaining(['Solicitudes', 'requests']),
    ]));
    expect(ROLE_CARDS.coordinador).toEqual(expect.arrayContaining([
      ['Registrar recolección de café', 'deliveries'],
    ]));
  });

  test('AplicacionPrincipal implementa todas las pantallas declaradas', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'aplicacion', 'AplicacionPrincipal.jsx'), 'utf8');
    APP_SCREEN_KEYS.forEach((screen) => {
      expect(source).toMatch(new RegExp(`\\b${screen}\\s*:`));
    });
  });

  test('centraliza el regreso al panel en el encabezado', () => {
    const frontendRoot = path.join(__dirname, '..', 'src');
    const header = fs.readFileSync(path.join(frontendRoot, 'componentes', 'comunes', 'Encabezado.jsx'), 'utf8');
    expect(header).toMatch(/screen !== 'dashboard'[\s\S]*Volver al panel principal/);
    expect(header).toMatch(/<Text style={styles\.backButtonText}>← Panel<\/Text>/);

    const moduleFiles = [];
    const collectJsx = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) collectJsx(target);
      else if (entry.name.endsWith('.jsx')) moduleFiles.push(target);
    });
    collectJsx(path.join(frontendRoot, 'modulos'));
    moduleFiles.forEach((file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/Volver al dashboard|Volver al panel|>Volver</);
    });
  });
});
