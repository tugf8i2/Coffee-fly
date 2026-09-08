export function sampleCoordinates(coordinates, maximum = 120) {
  if (coordinates.length <= maximum) return coordinates;
  const sampled = [];
  for (let index = 0; index < maximum; index += 1) {
    sampled.push(coordinates[Math.round(index * (coordinates.length - 1) / (maximum - 1))]);
  }
  return sampled;
}

export function projectCoordinates(coordinates, width, height, padding = 24) {
  if (!coordinates.length || width <= padding * 2 || height <= padding * 2) return [];
  const latitudes = coordinates.map((point) => Number(point.latitude));
  const longitudes = coordinates.map((point) => Number(point.longitude));
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const latitudeSpan = maximumLatitude - minimumLatitude;
  const longitudeSpan = maximumLongitude - minimumLongitude;
  return coordinates.map((point) => {
    const horizontal = longitudeSpan
      ? (Number(point.longitude) - minimumLongitude) / longitudeSpan : 0.5;
    const vertical = latitudeSpan
      ? (Number(point.latitude) - minimumLatitude) / latitudeSpan : 0.5;
    return {
      x: padding + horizontal * (width - padding * 2),
      y: height - padding - vertical * (height - padding * 2),
    };
  });
}

export function lineBetween(first, second) {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return {
    left: (first.x + second.x) / 2 - Math.hypot(deltaX, deltaY) / 2,
    top: (first.y + second.y) / 2 - 1.5,
    width: Math.hypot(deltaX, deltaY),
    angle: Math.atan2(deltaY, deltaX),
  };
}
