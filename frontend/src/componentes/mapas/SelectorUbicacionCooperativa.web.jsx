import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import MapaAbierto from './MapaAbierto';
import { buscarUbicacionPrecisa } from '../../servicios/ubicacionPrecisaWeb';

const valid = (latitude, longitude) => Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
  && Number(latitude) >= -90 && Number(latitude) <= 90
  && Number(longitude) >= -180 && Number(longitude) <= 180;

export default function SelectorUbicacionCooperativa({ latitude, longitude, onSelect, entityLabel = 'cooperativa' }) {
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const cancelLocation = useRef(null);
  useEffect(() => () => cancelLocation.current?.(), []);
  const selectManually = (coordinate) => {
    cancelLocation.current?.();
    setLocating(false);
    setLocationStatus('Punto seleccionado manualmente.');
    onSelect?.(coordinate);
  };
  const selected = valid(latitude, longitude) ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  const markers = selected ? [{
    id: 'selected-location', kind: 'selected', coordinate: selected, color: '#b42318', draggable: true,
    title: `Ubicación de la ${entityLabel}`, description: `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}`,
  }] : [];
  const useCurrentLocation = () => {
    if (locating) return;
    if (!navigator.geolocation) {
      setLocationStatus('Este navegador no permite obtener la ubicación actual.');
      return;
    }
    setLocating(true);
    setLocationStatus('');
    cancelLocation.current = buscarUbicacionPrecisa(navigator.geolocation, {
      onProgress: setLocationStatus,
      onSuccess: ({ coords }) => {
      const accuracy = Number(coords.accuracy);
      onSelect?.({ latitude: coords.latitude, longitude: coords.longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null });
      setLocationStatus(Number.isFinite(accuracy) ? `Precisión estimada: ±${Math.round(accuracy)} m.` : 'Ubicación actual seleccionada.');
      setLocating(false);
    }, onError: (error) => {
      setLocationStatus(error.message);
      setLocating(false);
    } });
  };
  return <View style={{ width: '100%', gap: 7 }}>
    <Text style={{ color: '#386641', fontWeight: '700' }}>Haz clic sobre el mapa para ubicar la {entityLabel}. También puedes arrastrar el marcador.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Usar mi ubicación actual para la ${entityLabel}`} disabled={locating} onPress={useCurrentLocation} style={{ alignSelf: 'flex-start', backgroundColor: locating ? '#87978a' : '#386641', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{locating ? 'Obteniendo ubicación precisa...' : 'Usar mi ubicación actual'}</Text>
    </Pressable>
    {locationStatus ? <Text accessibilityLiveRegion="polite" style={{ color: '#526451', fontSize: 12 }}>{locationStatus}</Text> : null}
    <MapaAbierto
      style={{ width: '100%', height: 380, borderRadius: 14 }}
      markers={markers}
      camera={{ fitMode: selected ? 'markers' : 'none', fitKey: selected ? `${selected.latitude}:${selected.longitude}` : 'colombia', zoom: 16 }}
      onMapPress={selectManually}
      onMarkerDragEnd={(_id, coordinate) => selectManually(coordinate)}
    />
    <Text style={{ color: '#526451', fontSize: 12 }}>Mapa © OpenStreetMap contributors · OpenFreeMap.</Text>
  </View>;
}
