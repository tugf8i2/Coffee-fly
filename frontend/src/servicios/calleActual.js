import { OSRM_BASE_URL } from '../configuracion/osrm';

const NEAREST_SERVICE = `${OSRM_BASE_URL}/nearest/v1/driving`;

export async function obtenerCalleActual(latitude, longitude, signal) {
  const response = await fetch(`${NEAREST_SERVICE}/${longitude},${latitude}?number=1`, { signal });
  if (!response.ok) return null;
  const data = await response.json();
  const name = data.waypoints?.[0]?.name?.trim();
  return name || null;
}
