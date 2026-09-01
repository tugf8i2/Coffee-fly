import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { lineBetween, projectCoordinates, sampleCoordinates } from './routePreviewMath';

const HEIGHT = 250;
const valid = (point) => Number.isFinite(Number(point?.latitude))
  && Number.isFinite(Number(point?.longitude));

export default function RoutePreview({ route = [], vehicle, destination }) {
  const [width, setWidth] = useState(0);
  const sampledRoute = useMemo(() => sampleCoordinates(route.filter(valid)), [route]);
  const allCoordinates = useMemo(() => [
    ...sampledRoute,
    ...(valid(vehicle) ? [vehicle] : []),
    ...(valid(destination) ? [destination] : []),
  ], [destination, sampledRoute, vehicle]);
  const projected = useMemo(
    () => projectCoordinates(allCoordinates, width, HEIGHT),
    [allCoordinates, width],
  );
  const routeProjected = projected.slice(0, sampledRoute.length);
  const vehiclePoint = valid(vehicle) ? projected[sampledRoute.length] : null;
  const destinationPoint = valid(destination)
    ? projected[sampledRoute.length + (valid(vehicle) ? 1 : 0)] : null;

  return <View>
    <Text style={{ color: '#293b2b', fontWeight: '700', marginBottom: 8 }}>Vista esquemática de la ruta</Text>
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: HEIGHT, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e8efe9', borderWidth: 1, borderColor: '#c4d4c6' }}
    >
      {[1, 2, 3].map((position) => <View key={`horizontal-${position}`} style={{ position: 'absolute', left: 0, right: 0, top: position * HEIGHT / 4, height: 1, backgroundColor: '#d2ded3' }} />)}
      {[1, 2, 3].map((position) => <View key={`vertical-${position}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${position * 25}%`, width: 1, backgroundColor: '#d2ded3' }} />)}
      {routeProjected.slice(1).map((point, index) => {
        const line = lineBetween(routeProjected[index], point);
        return <View key={`segment-${index}`} style={{
          position: 'absolute',
          left: line.left,
          top: line.top,
          width: line.width,
          height: 3,
          borderRadius: 2,
          backgroundColor: '#386641',
          transform: [{ rotate: `${line.angle}rad` }],
        }} />;
      })}
      {destinationPoint ? <View style={{ position: 'absolute', left: destinationPoint.x - 8, top: destinationPoint.y - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#b42318', borderWidth: 2, borderColor: '#fff' }} /> : null}
      {vehiclePoint ? <View style={{ position: 'absolute', left: vehiclePoint.x - 9, top: vehiclePoint.y - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1976d2', borderWidth: 3, borderColor: '#fff' }} /> : null}
      {!allCoordinates.length ? <Text style={{ color: '#526451', padding: 18 }}>Todavía no hay posiciones para dibujar.</Text> : null}
    </View>
    <Text style={{ color: '#526451', marginTop: 7 }}>Azul: vehículo · Rojo: destino · Verde: trayecto. Funciona sin mapa base.</Text>
  </View>;
}
