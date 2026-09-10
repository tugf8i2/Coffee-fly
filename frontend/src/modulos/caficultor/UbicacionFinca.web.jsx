import FormularioUbicacionFinca from './FormularioUbicacionFinca';

const obtenerUbicacionActual = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(Error('Este navegador no permite obtener tu ubicación.'));
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
    () => reject(Error('No fue posible obtener tu ubicación. Revisa el permiso del navegador.')),
    { enableHighAccuracy: true, timeout: 15000 },
  );
});

export default function UbicacionFinca({ token }) {
  return <FormularioUbicacionFinca token={token} obtenerUbicacionActual={obtenerUbicacionActual} />;
}
