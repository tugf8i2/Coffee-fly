import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { OPEN_MAP_DARK_STYLE_URL, OPEN_MAP_STYLE_URL } from '../../configuracion/mapaAbierto';
import { RUNNING_IN_EXPO_GO } from '../../configuracion/mapasNativos';
import MapaAbiertoWebView from './MapaAbiertoWebView.native';

let MapLibre;
if (!RUNNING_IN_EXPO_GO) {
  try {
    MapLibre = require('@maplibre/maplibre-react-native');
  } catch {
    MapLibre = null;
  }
}

const valid = (coordinate) => Number.isFinite(Number(coordinate?.latitude))
  && Number.isFinite(Number(coordinate?.longitude))
  && Number(coordinate.latitude) >= -90 && Number(coordinate.latitude) <= 90
  && Number(coordinate.longitude) >= -180 && Number(coordinate.longitude) <= 180;
const lngLat = (coordinate) => [Number(coordinate.longitude), Number(coordinate.latitude)];

function MapaNativo({ camera = {}, completedRoute = [], mapTheme = 'day', showNavigationControls = true, markers = [], onError, onManualMove, onMapPress, route = [], routeColor = '#3214d6', routeWidth = 6, style }) {
  const cameraRef = useRef(null);
  const appliedFitKeyRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const routeCoordinates = route.filter(valid).map(lngLat);
  const completedCoordinates = completedRoute.filter(valid).map(lngLat);
  const followed = markers.find((marker) => String(marker.id) === String(camera.followMarkerId) && valid(marker.coordinate));
  const routeShape = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: routeCoordinates },
  };
  const completedShape = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: completedCoordinates },
  };

  useEffect(() => {
    if (!loaded || !cameraRef.current) return;
    if (camera.follow && followed) {
      cameraRef.current.easeTo({
        center: lngLat(followed.coordinate),
        zoom: camera.zoom || 17,
        bearing: Number(camera.bearing || 0),
        pitch: Number(camera.pitch || 0),
        duration: 250,
      });
      return;
    }
    if (camera.fitMode === 'route' && routeCoordinates.length > 1 && appliedFitKeyRef.current !== camera.fitKey) {
      appliedFitKeyRef.current = camera.fitKey;
      const longitudes = routeCoordinates.map(([longitude]) => longitude);
      const latitudes = routeCoordinates.map(([, latitude]) => latitude);
      cameraRef.current.fitBounds(
        [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
        camera.padding || { top: 80, right: 60, bottom: 180, left: 60 },
        500,
      );
    }
  }, [camera.bearing, camera.fitKey, camera.fitMode, camera.follow, camera.padding, camera.pitch, camera.zoom, followed, loaded, routeCoordinates]);

  const initial = followed?.coordinate || route.find(valid) || markers.find((marker) => valid(marker.coordinate))?.coordinate;
  const { Camera, GeoJSONSource, Layer, Map, Marker } = MapLibre;
  return <Map
    style={style}
    mapStyle={mapTheme === 'dark' ? OPEN_MAP_DARK_STYLE_URL : OPEN_MAP_STYLE_URL}
    attribution
    logo={false}
    compass={showNavigationControls}
    androidView="surface"
    onPress={(event) => {
      const coordinate = event.nativeEvent?.lngLat;
      if (coordinate) onMapPress?.({ longitude: coordinate[0], latitude: coordinate[1] });
    }}
    onRegionWillChange={(event) => { if (event.nativeEvent?.userInteraction) onManualMove?.('move'); }}
    onDidFinishLoadingMap={() => setLoaded(true)}
    onDidFailLoadingMap={() => onError?.('No fue posible cargar las calles del mapa.')}
  >
    <Camera ref={cameraRef} initialViewState={{ center: initial ? lngLat(initial) : [-74.2973, 4.5709], zoom: initial ? 15 : 5 }} />
    {routeCoordinates.length > 1 ? <GeoJSONSource id="coffee-fly-route" data={routeShape}>
      <Layer id="coffee-fly-route-border" type="line" paint={{ 'line-color': '#fff', 'line-width': routeWidth + 4, 'line-opacity': 0.94 }} />
      <Layer id="coffee-fly-route-line" type="line" paint={{ 'line-color': routeColor, 'line-width': routeWidth }} />
    </GeoJSONSource> : null}
    {completedCoordinates.length > 1 ? <GeoJSONSource id="coffee-fly-completed-route" data={completedShape}>
      <Layer id="coffee-fly-completed-route-line" type="line" paint={{ 'line-color': '#7b8f80', 'line-width': 7, 'line-opacity': 0.95 }} />
    </GeoJSONSource> : null}
    {markers.filter((marker) => marker.id != null && valid(marker.coordinate)).map((marker) => <Marker key={String(marker.id)} id={String(marker.id)} lngLat={lngLat(marker.coordinate)}>
      {marker.kind === 'vehicle'
        ? <View accessibilityLabel={marker.title || 'Vehículo'} style={{ width: marker.size || 42, height: marker.size || 42, borderRadius: (marker.size || 42) / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 6 }}><Text style={{ color: marker.color || '#155eef', fontSize: (marker.size || 42) * 0.67, transform: [{ rotate: `${Number(marker.heading || 0)}deg` }] }}>▲</Text></View>
        : marker.kind === 'destination' ? <Svg accessibilityLabel={marker.title || 'Destino'} width={44} height={58} viewBox="0 0 44 58"><Path d="M22 56S2 34 2 22a20 20 0 0 1 40 0c0 12-20 34-20 34Z" fill={marker.color || '#c7333b'} stroke="#fff" strokeWidth={3}/><Circle cx={22} cy={22} r={8} fill="#fff"/></Svg>
        : <View accessibilityLabel={marker.title || 'Destino'} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: marker.color || '#b42318', borderWidth: 3, borderColor: '#fff' }} />}
    </Marker>)}
  </Map>;
}

export default function MapaAbierto(props) {
  if (RUNNING_IN_EXPO_GO) return <MapaAbiertoWebView {...props} />;
  if (!MapLibre?.Map || props.markers?.some((marker) => marker.draggable)) return <MapaAbiertoWebView {...props} />;
  return <MapaNativo {...props} />;
}
