import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

const valid = (coordinate) => Number.isFinite(Number(coordinate?.latitude))
  && Number.isFinite(Number(coordinate?.longitude))
  && Number(coordinate.latitude) >= -90 && Number(coordinate.latitude) <= 90
  && Number(coordinate.longitude) >= -180 && Number(coordinate.longitude) <= 180;

export default function MapaAbiertoExpoGo({ camera = {}, markers = [], onManualMove, onMapPress, onMarkerDragEnd, route = [], style }) {
  const mapRef = useRef(null);
  const appliedFitKeyRef = useRef(null);
  const [ready, setReady] = useState(false);
  const routeCoordinates = route.filter(valid).map((coordinate) => ({
    latitude: Number(coordinate.latitude), longitude: Number(coordinate.longitude),
  }));
  const visibleMarkers = markers.filter((marker) => marker.id != null && valid(marker.coordinate));
  const followed = visibleMarkers.find((marker) => String(marker.id) === String(camera.followMarkerId));
  const initial = followed?.coordinate || routeCoordinates.at(-1) || visibleMarkers[0]?.coordinate;
  const routeKey = routeCoordinates.map((coordinate) => `${coordinate.latitude.toFixed(5)}:${coordinate.longitude.toFixed(5)}`).join('|');

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (camera.follow && followed) {
      mapRef.current.animateCamera({
        center: followed.coordinate,
        zoom: camera.zoom || 17,
        heading: Number(camera.bearing || 0),
        pitch: Number(camera.pitch || 0),
      }, { duration: 250 });
      return;
    }
    if (camera.fitMode === 'route' && routeCoordinates.length > 1 && appliedFitKeyRef.current !== camera.fitKey) {
      appliedFitKeyRef.current = camera.fitKey;
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: camera.padding || { top: 90, right: 65, bottom: 190, left: 65 },
        animated: true,
      });
    }
  }, [camera.bearing, camera.fitKey, camera.fitMode, camera.follow, camera.padding, camera.pitch, camera.zoom, followed, ready, routeKey]);

  return <View style={style}>
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      initialRegion={{
        latitude: Number(initial?.latitude ?? 4.5709),
        longitude: Number(initial?.longitude ?? -74.2973),
        latitudeDelta: initial ? 0.015 : 7,
        longitudeDelta: initial ? 0.015 : 7,
      }}
      onMapReady={() => setReady(true)}
      onPanDrag={() => onManualMove?.('drag')}
      onPress={(event) => onMapPress?.(event.nativeEvent.coordinate)}
      rotateEnabled
      pitchEnabled
      toolbarEnabled={false}
    >
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
      {routeCoordinates.length > 1 ? <>
        <Polyline coordinates={routeCoordinates} strokeColor="#fff" strokeWidth={10} />
        <Polyline coordinates={routeCoordinates} strokeColor="#3214d6" strokeWidth={6} />
      </> : null}
      {visibleMarkers.map((marker) => <Marker
        key={String(marker.id)}
        identifier={String(marker.id)}
        coordinate={marker.coordinate}
        title={marker.title}
        description={marker.description}
        pinColor={marker.kind === 'vehicle' ? '#155eef' : marker.color || '#b42318'}
        rotation={marker.kind === 'vehicle' ? Number(marker.heading || 0) : 0}
        flat={marker.kind === 'vehicle'}
        draggable={Boolean(marker.draggable)}
        onDragEnd={(event) => onMarkerDragEnd?.(marker.id, event.nativeEvent.coordinate)}
      />)}
    </MapView>
    <Text style={{ position: 'absolute', right: 5, bottom: 3, backgroundColor: 'rgba(255,255,255,.86)', color: '#33443a', fontSize: 9, paddingHorizontal: 4 }}>© OpenStreetMap contributors</Text>
  </View>;
}
