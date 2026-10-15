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
  const [mapBearing, setMapBearing] = useState(0);
  const commands = useRef(null);
  const lastHeading = useRef(0);
  if (Number.isFinite(Number(heading))) lastHeading.current = Number(heading);
  const arrowRotation = ((lastHeading.current - mapBearing) % 360 + 360) % 360;
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
  return (
    <View style={{ flex: 1 }}>
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
              kind: 'vehicle-location',
              coordinate: vehicle,
              heading,
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
      onBearingChange={(bearing) => setMapBearing(bearing)}
      mapTheme={mapTheme}
      fallback={<View style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
        <RoutePreview route={route} vehicle={vehicle} destination={destination} />
        <Text style={{ color: '#36523b', textAlign: 'center', marginTop: 12 }}>
          No hay calles guardadas para esta zona. Conéctate y abre el mapa antes de iniciar el viaje.
        </Text>
      </View>}
    />
    {offline ? <Text style={{ position: 'absolute', left: 12, right: 12, bottom: 12, color: '#153b62', backgroundColor: '#fffffff0', padding: 7, borderRadius: 8, textAlign: 'center' }}>
      Sin Internet: se muestran las calles descargadas para la ruta o abiertas previamente.
    </Text> : null}
    <View pointerEvents="none" accessibilityLabel={vehicle ? 'Indicador fijo del rumbo del conductor' : 'Indicador de rumbo, esperando GPS'} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffffed', borderWidth: 3, borderColor: '#0878ff', alignItems: 'center', justifyContent: 'center', elevation: 7, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 7 }}>
        <Text style={{ fontSize: 39, lineHeight: 47, color: '#0878ff', transform: [{ rotate: `${arrowRotation}deg` }] }}>▲</Text>
      </View>
      <Text style={{ color: '#153b62', backgroundColor: '#fffffff0', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, fontWeight: '700', marginTop: 4 }}>
        {vehicle ? (follow ? 'Mi posición y rumbo' : 'Rumbo · mapa desplazado') : 'Esperando GPS'}
      </Text>
    </View>
    </View>
  );
}
