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
  'deliveries',
  'vehicleAssignment',
  'assignmentHistory',
  'assignedDeliveries',
  'deliveryHistory',
  'reports',
  'monitoring',
  'support',
]);

export const SCREEN_LABELS = Object.freeze({
  login: 'Inicio de sesión',
  dashboard: 'Panel principal',
  request: 'Solicitar recolección',
  farmLocation: 'Ubicación de finca',
  farmerDashboard: 'Mi actividad',
  tracking: 'Seguimiento de vehículos',
  users: 'Gestión de usuarios',
  cooperatives: 'Cooperativas',
  vehicles: 'Gestión de vehículos',
  vehicleStatus: 'Estado de vehículos',
  deliveries: 'Registrar recolección',
  vehicleAssignment: 'Asignar vehículo',
  assignmentHistory: 'Historial de asignaciones',
  assignedDeliveries: 'Recolecciones asignadas',
  deliveryHistory: 'Historial de entregas',
  reports: 'Reportes',
  monitoring: 'Monitoreo operativo',
  support: 'Servicio al cliente',
});

export const ROLE_CARDS = Object.freeze({
  caficultor: Object.freeze([
    ['Guardar ubicación de finca', 'farmLocation'],
    ['Solicitar recolección', 'request'],
    ['Mi actividad', 'farmerDashboard'],
    ['Historial de entregas', 'deliveryHistory'],
    ['Seguimiento de vehículo', 'tracking'],
    ['Servicio al cliente', 'support'],
  ]),
  registrador: Object.freeze([
    ['Usuarios', 'users'],
    ['Cooperativas y ubicación', 'cooperatives'],
    ['Vehículos y estados', 'vehicles'],
  ]),
  coordinador: Object.freeze([
    ['Registrar recolección de café', 'deliveries'],
    ['Asignar vehículo', 'vehicleAssignment'],
    ['Estado de vehículos', 'vehicleStatus'],
    ['Historial de entregas', 'deliveryHistory'],
    ['Seguimiento de vehículos', 'tracking'],
    ['Monitoreo operativo', 'monitoring'],
    ['Historial de asignaciones', 'assignmentHistory'],
    ['Reportes', 'reports'],
    ['Servicio al cliente', 'support'],
  ]),
  conductor: Object.freeze([
    ['Recolecciones asignadas', 'assignedDeliveries'],
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
