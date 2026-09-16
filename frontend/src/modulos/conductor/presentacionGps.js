import { driverDate } from './presentacionConductor';

export function distanceCoordinates(first, second) {
  if (
    !first ||
    !second ||
    [first.latitude, first.longitude, second.latitude, second.longitude].some(
      (n) => n == null || !Number.isFinite(Number(n)),
    )
  )
    return null;
  const radians = (n) => (Number(n) * Math.PI) / 180;
  const a =
    Math.sin(radians(second.latitude - first.latitude) / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(radians(second.longitude - first.longitude) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function compactDistance(meters) {
  if (meters == null || !Number.isFinite(Number(meters))) return '—';
  return Number(meters) < 1000
    ? `${Math.round(Math.max(0, Number(meters)) / 10) * 10} m`
    : `${(Number(meters) / 1000).toFixed(1)} km`;
}
export function turnIcon(text = '') {
  const normalized = text.toLowerCase();
  if (normalized.includes('izquierda')) return 'turnLeft';
  if (normalized.includes('derecha')) return 'turnRight';
  if (normalized.includes('glorieta') || normalized.includes('rotonda'))
    return 'roundabout';
  if (normalized.includes('llegado') || normalized.includes('destino'))
    return 'flag';
  return 'straight';
}
export function gpsStop(trip, deliveryId, stage) {
  const loads = trip?.cargas || [];
  const index = loads.findIndex((load) => load.id_entrega === deliveryId);
  const cooperative = stage === 'hacia_cooperativa';
  return {
    load: loads[index] || null,
    number: cooperative ? loads.length + 1 : index < 0 ? null : index + 1,
    total: loads.length + 1,
    cooperative,
  };
}
export function canAdvanceGpsInstruction(point) {
  const time = driverDate(point?.registrada_en)?.getTime();
  return (
    point?.precision_m != null &&
    Number(point.precision_m) >= 0 &&
    Number(point.precision_m) <= 25 &&
    point?.latitud != null &&
    point?.longitud != null &&
    Number.isFinite(Number(point.latitud)) &&
    Math.abs(Number(point.latitud)) <= 90 &&
    Number.isFinite(Number(point.longitud)) &&
    Math.abs(Number(point.longitud)) <= 180 &&
    time != null &&
    time <= Date.now() + 10000 &&
    Date.now() - time <= 90000
  );
}
export function canConfirmDriverPickup(tracking, point) {
  if (tracking?.etapa_viaje !== 'hacia_finca' || tracking?.carga_recogida_en || !canAdvanceGpsInstruction(point)) return false;
  const latitude = tracking.recoleccion_latitud ?? tracking.destino_latitud;
  const longitude = tracking.recoleccion_longitud ?? tracking.destino_longitud;
  const distance = distanceCoordinates({latitude:Number(point.latitud),longitude:Number(point.longitud)},{latitude,longitude});
  return distance != null && distance <= Number(tracking.radio_confirmacion_m || 250);
}
