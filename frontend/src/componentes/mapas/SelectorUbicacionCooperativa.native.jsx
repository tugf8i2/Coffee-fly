import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const DEFAULT_CENTER = { latitude: 4.5709, longitude: -74.2973 };

const validCoordinate = (latitude, longitude) => Number.isFinite(Number(latitude))
  && Number.isFinite(Number(longitude))
  && Number(latitude) >= -90
  && Number(latitude) <= 90
  && Number(longitude) >= -180
  && Number(longitude) <= 180;

export default function SelectorUbicacionCooperativa({ latitude, longitude, onSelect }) {
  const mapRef = useRef(null);
  const selected = validCoordinate(latitude, longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
  const center = selected || DEFAULT_CENTER;

  useEffect(() => {
    if (!selected) return;
    mapRef.current?.animateToRegion({ ...selected, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 450);
  }, [latitude, longitude]);

  return <View style={{ width: '100%', gap: 7 }}>
    <Text style={{ color: '#386641', fontWeight: '700' }}>Toca el mapa para ubicar la cooperativa. También puedes arrastrar el marcador.</Text>
    <View style={{ width: '100%', height: 360, overflow: 'hidden', borderRadius: 14 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        mapType="standard"
        initialRegion={{ ...center, latitudeDelta: selected ? 0.025 : 8, longitudeDelta: selected ? 0.025 : 8 }}
        onPress={(event) => onSelect?.(event.nativeEvent.coordinate)}
        loadingEnabled
        showsCompass
        showsScale
        toolbarEnabled
        zoomControlEnabled
      >
        {selected ? <Marker coordinate={selected} draggable onDragEnd={(event) => onSelect?.(event.nativeEvent.coordinate)} title="Ubicación de la cooperativa" /> : null}
      </MapView>
    </View>
    <Text style={{ color: '#526451', fontSize: 12 }}>Toca o arrastra el marcador para ajustar el punto exacto.</Text>
  </View>;
}
