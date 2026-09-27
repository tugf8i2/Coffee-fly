import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import MapaAbierto from '../../componentes/mapas/MapaAbierto.native';
import RoutePreview from '../../componentes/mapas/VistaPreviaRuta';
import { obtenerEstadoMapaSinConexion } from '../../servicios/mapaSinConexion';
import { navigationCameraLayout } from './presentacionGps';

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
  const { width, height } = useWindowDimensions();
  const cameraLayout = navigationCameraLayout(width, height);
  const [follow, setFollow] = useState(true);
  const [fitRevision, setFitRevision] = useState(0);
  const [zoom, setZoom] = useState(cameraLayout.zoom);
  const [zoomCommand, setZoomCommand] = useState(null);
  const [north, setNorth] = useState(false);
  const [offlineMap, setOfflineMap] = useState({ listo: false, progreso: 0 });
  useEffect(() => {
    setFollow(true);
    setNorth(false);
    setZoom(cameraLayout.zoom);
  }, [deliveryId]);
  useEffect(() => {
    setFollow(true);
    setZoom(cameraLayout.zoom);
  }, [cameraLayout.landscape, cameraLayout.zoom]);
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
      explore: () => setFollow(false),
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);
  useEffect(() => {
    let disposed = false;
    setOfflineMap({ listo: false, progreso: 0 });
    obtenerEstadoMapaSinConexion(deliveryId, route)
      .then((state) => { if (!disposed) setOfflineMap(state); })
      .catch((error) => { if (!disposed) setOfflineMap({ listo: false, motivo: error.message }); });
    return () => { disposed = true; };
  }, [deliveryId, offline, route]);
  if (offline && !offlineMap.listo) return <View style={{ flex: 1, justifyContent: 'center', padding: 12, backgroundColor: '#e8efe9' }}>
    <RoutePreview route={route} vehicle={vehicle} destination={destination} />
    <Text style={{ color: '#36523b', textAlign: 'center', marginTop: 12 }}>
      {offlineMap.motivo || (offlineMap.progreso > 0
        ? `El mapa regional esta descargado al ${offlineMap.progreso} %. La ruta y el GPS siguen disponibles.`
        : 'Ruta esquematica sin conexion. Prepara el mapa regional antes del viaje para conservar las calles.')}
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
      mapStyleUrl={offline ? offlineMap.mapStyle : undefined}
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
        pitch: cameraLayout.pitch,
        padding: cameraLayout.fitPadding,
        followPadding: cameraLayout.followPadding,
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
