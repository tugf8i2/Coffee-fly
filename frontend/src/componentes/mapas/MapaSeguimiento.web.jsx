import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import MapaAbierto from './MapaAbierto';
import { trackingFitKey } from '../../servicios/presentacionSeguimiento';
import useTrackingPosition from '../../ganchos/usarPosicionSeguimiento';

export default function MapaSeguimiento({ deliveryId, destination, navigationRoute = [], points = [] }) {
  const [follow, setFollow] = useState(true);
  const [fitRequest, setFitRequest] = useState(0);
  useEffect(() => { setFollow(true); setFitRequest(0); }, [deliveryId]);
  const position = useTrackingPosition(points);
  const trail = position.points.map((point) => ({ latitude: Number(point.latitud), longitude: Number(point.longitud) }));
  const route = [...trail, ...navigationRoute.filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude))];
  const last = position.point;
  const vehicle = last ? { latitude: Number(last.latitud), longitude: Number(last.longitud) } : null;
  const markers = [
    vehicle ? {
      id: 'vehicle', kind: 'vehicle', coordinate: vehicle, heading: last.rumbo_grados,
      title: 'Conductor',
      color: position.stale || position.degraded ? '#b76a00' : '#155eef',
      description: `${vehicle.latitude.toFixed(6)}, ${vehicle.longitude.toFixed(6)}${last.precision_m != null ? ` · precisión ±${Math.round(last.precision_m)} m` : ''}${last.velocidad_m_s != null ? ` · ${(last.velocidad_m_s * 3.6).toFixed(1)} km/h` : ''}`,
    } : null,
    destination ? { id: 'destination', coordinate: destination, color: '#c5221f', title: 'Destino' } : null,
  ].filter(Boolean);

  return <View style={{ width: '100%', height: 460, marginTop: 14, marginBottom: 8, borderRadius: 14, overflow: 'hidden' }}>
    <MapaAbierto
      style={{ flex: 1 }}
      route={route}
      markers={markers}
      camera={{ fitMode: 'route', fitKey: `${trackingFitKey(deliveryId, destination)}:${fitRequest}`, follow, followMarkerId: 'vehicle', bearing: last?.rumbo_grados, zoom: 16, maxZoom: 17, padding: 36 }}
      onManualMove={() => setFollow(false)}
    />
    <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 12, bottom: 34, right: 50, backgroundColor: '#fff', color: '#526451', padding: 8 }}>{position.status}</Text>
    <View style={{ position: 'absolute', right: 12, top: 12, gap: 8 }}>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setFollow(false); setFitRequest((value) => value + 1); }} style={{ backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: '#17351f', fontWeight: '800' }}>Ruta completa</Text></TouchableOpacity>
      {!follow && vehicle ? <TouchableOpacity accessibilityRole="button" onPress={() => setFollow(true)} style={{ backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: '#17351f', fontWeight: '800' }}>Centrar conductor</Text></TouchableOpacity> : null}
    </View>
  </View>;
}
