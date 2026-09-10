const PHOTON_API = 'https://photon.komoot.io';

const formatAddress = (properties = {}) => {
  const street = [properties.street, properties.housenumber].filter(Boolean).join(' ');
  return [properties.name, street, properties.district, properties.city || properties.county, properties.state, properties.country]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(', ');
};

const asResult = (feature) => ({
  direccion: formatAddress(feature.properties),
  latitude: Number(feature.geometry.coordinates[1]),
  longitude: Number(feature.geometry.coordinates[0]),
});

export async function buscarDirecciones(query, signal) {
  const text = query.trim();
  if (text.length < 3) return [];
  const response = await fetch(`${PHOTON_API}/api/?q=${encodeURIComponent(text)}&limit=6&bbox=-79,-4,-66,13`, { signal });
  if (!response.ok) throw Error('No fue posible consultar direcciones en este momento.');
  const data = await response.json();
  return (data.features || []).map(asResult).filter((item) => item.direccion && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

export async function obtenerDireccion(latitude, longitude) {
  const response = await fetch(`${PHOTON_API}/reverse?lat=${latitude}&lon=${longitude}`);
  if (!response.ok) return null;
  const data = await response.json();
  const feature = data.features?.[0];
  return feature ? asResult(feature).direccion : null;
}
