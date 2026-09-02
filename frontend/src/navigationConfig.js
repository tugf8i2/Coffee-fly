export const APP_SCREEN_KEYS = Object.freeze([
  'login',
  'dashboard',
  'request',
  'farmLocation',
  'farmerDashboard',
  'tracking',
  'users',
  'cooperatives',
  'vehicles',
  'vehicleStatus',
  'requests',
  'deliveries',
  'vehicleAssignment',
  'assignmentHistory',
  'assignedDeliveries',
  'deliveryHistory',
  'reports',
  'monitoring',
]);

export const ROLE_CARDS = Object.freeze({
  caficultor: Object.freeze([
    ['Guardar ubicación de finca', 'farmLocation'],
    ['Solicitar recolección', 'request'],
    ['Mi actividad', 'farmerDashboard'],
    ['Historial de entregas', 'deliveryHistory'],
    ['Seguimiento de vehículo', 'tracking'],
  ]),
  registrador: Object.freeze([
    ['Usuarios', 'users'],
    ['Cooperativas y ubicación', 'cooperatives'],
    ['Vehículos y estados', 'vehicles'],
  ]),
  coordinador: Object.freeze([
    ['Solicitudes', 'requests'],
    ['Registrar entrega de café', 'deliveries'],
    ['Asignar vehículo', 'vehicleAssignment'],
    ['Estado de vehículos', 'vehicleStatus'],
    ['Historial de entregas', 'deliveryHistory'],
    ['Seguimiento de vehículos', 'tracking'],
    ['Monitoreo operativo', 'monitoring'],
    ['Historial de asignaciones', 'assignmentHistory'],
    ['Reportes', 'reports'],
  ]),
  conductor: Object.freeze([
    ['Mis entregas asignadas', 'assignedDeliveries'],
    ['GPS y trayecto', 'tracking'],
  ]),
});

export function navigationTargets() {
  return Object.values(ROLE_CARDS).flatMap((cards) => cards.map(([, screen]) => screen));
}

export function findNavigationErrors(registeredScreens) {
  const registered = new Set(registeredScreens);
  return [...new Set(navigationTargets().filter((screen) => !registered.has(screen)))];
}
