import MapaAbierto from './MapaAbierto.native';

export default function MapaNavegacionAbierto({ completedRoute, destination, fallback, fitKey, follow, heading, mapTheme, onError, onManualMove, route, style, vehicle, vehicleDescription }) {
  const markers = [
    vehicle ? { id: 'vehicle', kind: 'vehicle', coordinate: vehicle, heading, title: 'Conductor', description: vehicleDescription || 'Ubicación GPS actual' } : null,
    destination ? { id: 'destination', coordinate: destination, color: '#c5221f', title: 'Destino' } : null,
  ].filter(Boolean);

  return <MapaAbierto
    style={style}
    fallback={fallback}
    route={route}
    completedRoute={completedRoute}
    mapTheme={mapTheme}
    markers={markers}
    camera={{
      fitMode: 'route',
      fitKey,
      follow,
      followMarkerId: 'vehicle',
      bearing: heading,
      pitch: 45,
      zoom: 17,
      padding: { top: 220, right: 60, bottom: 210, left: 60 },
      maxZoom: 18,
    }}
    onManualMove={onManualMove}
    onError={onError}
  />;
}
