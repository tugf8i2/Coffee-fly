import { useEffect, useRef, useState } from 'react';
import MapaAbierto from '../../componentes/mapas/MapaAbierto';

export default function MapaGpsConductor({
  controlsRef,
  route = [],
  destination,
  vehicle,
  heading,
  deliveryId,
  mapTheme = 'day',
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
      fit: () => {
        setFollow(false);
        setFitRevision((current) => current + 1);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);
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
