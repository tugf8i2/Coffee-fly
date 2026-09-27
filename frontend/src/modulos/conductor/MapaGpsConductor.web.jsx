import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import MapaAbierto from '../../componentes/mapas/MapaAbierto';
import RoutePreview from '../../componentes/mapas/VistaPreviaRuta';

export default function MapaGpsConductor({
  controlsRef,
  route = [],
  destination,
  vehicle,
  heading,
  deliveryId,
  mapTheme = 'day',
  offline = false,
}) {
  const [follow, setFollow] = useState(true);
  const [fitRevision, setFitRevision] = useState(0);
  const commands = useRef(null);
  useEffect(() => setFollow(true), [deliveryId]);
  useEffect(() => {
    controlsRef.current = {
      zoomIn: () => commands.current?.zoomIn?.(),
      zoomOut: () => commands.current?.zoomOut?.(),
      north: () => commands.current?.north?.(),
      center: () => setFollow(true),
      explore: () => setFollow(false),
      fit: () => {
        setFollow(false);
        setFitRevision((current) => current + 1);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);
  if (offline) return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 12, backgroundColor: '#e8efe9' }}>
      <RoutePreview route={route} vehicle={vehicle} destination={destination} />
      <Text style={{ color: '#36523b', textAlign: 'center', marginTop: 12 }}>
        Ruta esquematica sin conexion. La PWA conserva el viaje y el GPS; los mapas regionales descargables estan disponibles en la app movil.
      </Text>
    </View>
  );
  return (
    <MapaAbierto
      style={{ flex: 1 }}
      controlsRef={commands}
      showNavigationControls={false}
      route={route}
      routeColor="#0878ff"
      routeWidth={13}
      markers={[
        vehicle
          ? {
              id: 'vehicle',
              kind: 'vehicle',
              size: 68,
              coordinate: vehicle,
              heading,
              title: 'Conductor',
              color: '#0878ff',
            }
          : null,
        destination
          ? {
              id: 'destination',
              kind: 'destination',
              coordinate: destination,
              color: '#c7333b',
              title: 'Destino actual',
            }
          : null,
      ].filter(Boolean)}
      camera={{
        fitMode: 'route',
        fitKey: `${deliveryId}:${fitRevision}`,
        follow,
        followMarkerId: 'vehicle',
        bearing: heading,
        zoom: 17,
        pitch: 15,
        padding: { top: 190, right: 85, bottom: 160, left: 40 },
      }}
      onManualMove={() => setFollow(false)}
      mapTheme={mapTheme}
    />
  );
}
