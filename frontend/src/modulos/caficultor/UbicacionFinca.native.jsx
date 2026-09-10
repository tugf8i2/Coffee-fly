import * as Location from 'expo-location';

import FormularioUbicacionFinca from './FormularioUbicacionFinca';

const obtenerUbicacionActual = async () => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw Error('Debes permitir la ubicación para guardar el destino de recolección.');
  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: current.coords.latitude, longitude: current.coords.longitude };
};

export default function UbicacionFinca({ token }) {
  return <FormularioUbicacionFinca token={token} obtenerUbicacionActual={obtenerUbicacionActual} />;
}
