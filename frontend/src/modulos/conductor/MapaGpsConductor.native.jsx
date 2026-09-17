import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import MapaAbierto from '../../componentes/mapas/MapaAbierto.native';
import RoutePreview from '../../componentes/mapas/VistaPreviaRuta';

export default function MapaGpsConductor({
  controlsRef,
  route = [],
  completedRoute = [],
  destination,
  vehicle,
  heading,
  deliveryId,
  mapTheme = 'day',
  offline = false,
}) {
  const [follow, setFollow] = useState(true);
  const [fitRevision, setFitRevision] = useState(0);
  const [zoom, setZoom] = useState(17);
  const [zoomCommand, setZoomCommand] = useState(null);
  const [north, setNorth] = useState(false);
  useEffect(() => {
    setFollow(true);
    setNorth(false);
    setZoom(17);
  }, [deliveryId]);
  useEffect(() => {
    controlsRef.current = {
      zoomIn: () => {
        setFollow(false);
        setZoomCommand((value) => ({ id: (value?.id || 0) + 1, delta: 1 }));
      },
      zoomOut: () => {
        setFollow(false);
        setZoomCommand((value) => ({ id: (value?.id || 0) + 1, delta: -1 }));
      },
      north: () => {
        setNorth(true);
        setFollow(true);
      },
      center: () => {
        setNorth(false);
        setFollow(true);
      },
      fit: () => {
        setFollow(false);
        setFitRevision((current) => current + 1);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);
  if (offline) return <View style={{ flex: 1, justifyContent: 'center', padding: 12, backgroundColor: '#e8efe9' }}>
    <RoutePreview route={route} vehicle={vehicle} destination={destination} />
    <Text style={{ color: '#36523b', textAlign: 'center', marginTop: 12 }}>
      Ruta esquemática sin conexión. El GPS y la ruta guardada siguen disponibles; las calles requieren Internet.
    </Text>
  </View>;
  return (
    <MapaAbierto
      style={{ flex: 1 }}
      route={route}
      completedRoute={completedRoute}
      routeColor="#0878ff"
      routeWidth={13}
      showNavigationControls={false}
      mapTheme={mapTheme}
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
        bearing: north ? 0 : heading,
        zoom,
        zoomCommand,
        pitch: 15,
        padding: { top: 190, right: 85, bottom: 160, left: 40 },
      }}
      onManualMove={() => setFollow(false)}
      fallback={
        <RoutePreview
          route={route}
          vehicle={vehicle}
          destination={destination}
        />
      }
    />
  );
}
