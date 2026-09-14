import { useState } from 'react';
import * as Location from 'expo-location';
import { Pressable, Text, View } from 'react-native';

import MapaAbierto from './MapaAbierto.native';

const validCoordinate = (latitude, longitude) => Number.isFinite(Number(latitude))
  && Number.isFinite(Number(longitude))
  && Number(latitude) >= -90
  && Number(latitude) <= 90
  && Number(longitude) >= -180
  && Number(longitude) <= 180;

export default function SelectorUbicacionCooperativa({ latitude, longitude, onSelect, entityLabel = 'cooperativa' }) {
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const selected = validCoordinate(latitude, longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
  const markers = selected ? [{
    id: 'selected-location',
    kind: 'selected',
    coordinate: selected,
    color: '#b42318',
    draggable: true,
    title: `Ubicación de la ${entityLabel}`,
    description: `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}`,
  }] : [];
  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    setLocationStatus('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw Error('Autoriza la ubicación para seleccionar tu posición actual.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest, mayShowUserSettingsDialog: true });
      const accuracy = Number(location.coords.accuracy);
      onSelect?.({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null });
      setLocationStatus(Number.isFinite(accuracy) ? `Precisión estimada: ±${Math.round(accuracy)} m.` : 'Ubicación actual seleccionada.');
    } catch (error) {
      setLocationStatus(error.message || 'No fue posible obtener la ubicación actual.');
    } finally {
      setLocating(false);
    }
  };

  return <View style={{ width: '100%', gap: 7 }}>
    <Text style={{ color: '#386641', fontWeight: '700' }}>Toca el mapa para ubicar la {entityLabel}. También puedes arrastrar el marcador.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Usar mi ubicación actual para la ${entityLabel}`} disabled={locating} onPress={useCurrentLocation} style={{ alignSelf: 'flex-start', backgroundColor: locating ? '#87978a' : '#386641', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{locating ? 'Obteniendo ubicación precisa...' : 'Usar mi ubicación actual'}</Text>
    </Pressable>
    {locationStatus ? <Text accessibilityLiveRegion="polite" style={{ color: '#526451', fontSize: 12 }}>{locationStatus}</Text> : null}
    <View style={{ width: '100%', height: 360, overflow: 'hidden', borderRadius: 14 }}>
      <MapaAbierto
        style={{ flex: 1 }}
        markers={markers}
        camera={{ fitMode: selected ? 'markers' : 'none', fitKey: selected ? `${selected.latitude}:${selected.longitude}` : 'colombia', zoom: 16 }}
        onMapPress={onSelect}
        onMarkerDragEnd={(_id, coordinate) => onSelect?.(coordinate)}
      />
    </View>
    <Text style={{ color: '#526451', fontSize: 12 }}>Toca o arrastra el marcador para ajustar el punto exacto.</Text>
  </View>;
}
