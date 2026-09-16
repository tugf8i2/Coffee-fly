import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import MapaAbierto from './MapaAbierto';

const valid = (vehicle) => vehicle?.latitud != null && vehicle?.longitud != null && Number.isFinite(Number(vehicle.latitud)) && Number.isFinite(Number(vehicle.longitud))
  && Number(vehicle.latitud) >= -90 && Number(vehicle.latitud) <= 90
  && Number(vehicle.longitud) >= -180 && Number(vehicle.longitud) <= 180;
const color = (state) => state === 'actualizado' ? '#2e7d32' : state === 'desactualizado' ? '#f57c00' : '#757575';

export default function MapaFlota({ vehicles = [], height = 400 }) {
  const [fitRevision, setFitRevision] = useState(0);
  const visible = vehicles.filter(valid);
  const markers = visible.map((vehicle) => ({
    id: vehicle.entrega_id,
    kind: 'vehicle',
    coordinate: { latitude: Number(vehicle.latitud), longitude: Number(vehicle.longitud) },
    heading: Number(vehicle.rumbo_grados || 0),
    color: color(vehicle.estado_gps),
    title: vehicle.placa || 'Vehículo',
    description: `${vehicle.estado_gps} · ${Number(vehicle.latitud).toFixed(6)}, ${Number(vehicle.longitud).toFixed(6)}${vehicle.precision_m != null ? ` · precisión ±${Math.round(vehicle.precision_m)} m` : ''}${vehicle.velocidad_m_s != null ? ` · ${(vehicle.velocidad_m_s * 3.6).toFixed(1)} km/h` : ''}`,
  }));
  const fitKey = `${visible.map((vehicle) => String(vehicle.entrega_id)).sort().join('|')}:${fitRevision}`;
  return <View style={{ width: '100%', height, marginTop: 8, marginBottom: 8, borderRadius: 9, overflow: 'hidden' }}>
    <MapaAbierto style={{ flex: 1 }} markers={markers} camera={{ fitMode: 'markers', fitKey, zoom: 16, maxZoom: 16, padding: 38 }} />
    {visible.length ? <TouchableOpacity accessibilityRole="button" onPress={() => setFitRevision((value) => value + 1)} style={{ position: 'absolute', right: 12, top: 12, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: '#17351f', fontWeight: '800' }}>Encuadrar flota</Text></TouchableOpacity> : null}
    {!visible.length ? <Text style={{ position: 'absolute', left: 15, top: 15, color: '#526451', backgroundColor: '#fff', padding: 8 }}>Aún no hay posiciones GPS para mostrar.</Text> : null}
  </View>;
}
