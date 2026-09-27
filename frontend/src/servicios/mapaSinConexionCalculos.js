const EARTH_RADIUS_KM = 6371.0088;

const radians = (value) => (Number(value) * Math.PI) / 180;
const valid = (point) => Number.isFinite(Number(point?.latitude))
  && Number.isFinite(Number(point?.longitude))
  && Number(point.latitude) >= -90 && Number(point.latitude) <= 90
  && Number(point.longitude) >= -180 && Number(point.longitude) <= 180;

export function distanciaKm(a, b) {
  const latitudeDelta = radians(Number(b.latitude) - Number(a.latitude));
  const longitudeDelta = radians(Number(b.longitude) - Number(a.longitude));
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const h = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function segmentarCorredorRuta(route, maximumSegmentKm = 20) {
  const points = (route || []).filter(valid).map((point) => ({
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  }));
  if (points.length < 2) return [];
  const maximum = Math.max(1, Number(maximumSegmentKm) || 20);
  const segments = [];
  let current = [points[0]];
  let accumulated = 0;
  for (let index = 1; index < points.length; index += 1) {
    const distance = distanciaKm(points[index - 1], points[index]);
    if (current.length > 1 && accumulated + distance > maximum) {
      segments.push(current);
      current = [points[index - 1]];
      accumulated = 0;
    }
    current.push(points[index]);
    accumulated += distance;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

export function limitesCorredor(points, corridorKm = 5) {
  const validPoints = (points || []).filter(valid);
  if (!validPoints.length) throw new Error('La ruta no contiene coordenadas validas.');
  const latitudes = validPoints.map((point) => Number(point.latitude));
  const longitudes = validPoints.map((point) => Number(point.longitude));
  const middleLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const latitudePadding = Math.max(0.5, Number(corridorKm) || 5) / 110.574;
  const longitudePadding = Math.max(0.5, Number(corridorKm) || 5)
    / Math.max(1, 111.320 * Math.cos(radians(middleLatitude)));
  return [
    Math.max(-180, Math.min(...longitudes) - longitudePadding),
    Math.max(-85.05112878, Math.min(...latitudes) - latitudePadding),
    Math.min(180, Math.max(...longitudes) + longitudePadding),
    Math.min(85.05112878, Math.max(...latitudes) + latitudePadding),
  ];
}

function tileX(longitude, zoom) {
  return Math.floor(((Number(longitude) + 180) / 360) * (2 ** zoom));
}

function tileY(latitude, zoom) {
  const lat = radians(Math.max(-85.05112878, Math.min(85.05112878, Number(latitude))));
  return Math.floor((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * (2 ** zoom));
}

export function estimarCantidadTiles(bounds, minZoom = 9, maxZoom = 16) {
  const [west, south, east, north] = bounds.map(Number);
  let total = 0;
  for (let zoom = Math.floor(minZoom); zoom <= Math.floor(maxZoom); zoom += 1) {
    const columns = Math.abs(tileX(east, zoom) - tileX(west, zoom)) + 1;
    const rows = Math.abs(tileY(south, zoom) - tileY(north, zoom)) + 1;
    total += columns * rows;
  }
  return total;
}

export function estimarTamanoDescargaBytes(tileCount, averageTileKb = 25) {
  const tiles = Math.max(0, Number(tileCount) || 0);
  const tileBytes = Math.max(1, Number(averageTileKb) || 25) * 1024;
  return Math.ceil(tiles * tileBytes);
}

export function versionRuta(route) {
  const text = (route || []).filter(valid)
    .map((point) => `${Number(point.latitude).toFixed(5)},${Number(point.longitude).toFixed(5)}`)
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
