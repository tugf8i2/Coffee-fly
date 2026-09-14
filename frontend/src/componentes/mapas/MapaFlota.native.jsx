import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import MapaAbierto from './MapaAbierto.native';

const isValidCoordinate = (vehicle) => Number.isFinite(Number(vehicle?.latitud))
  && Number.isFinite(Number(vehicle?.longitud))
  && Number(vehicle.latitud) >= -90
  && Number(vehicle.latitud) <= 90
  && Number(vehicle.longitud) >= -180
  && Number(vehicle.longitud) <= 180;

const markerColor = (state) => (
  state === 'actualizado' ? '#2e7d32' : state === 'desactualizado' ? '#f57c00' : '#757575'
);

export default function MapaFlota({ vehicles = [] }) {
  const [fitRevision, setFitRevision] = useState(0);
  const visible = vehicles.filter(isValidCoordinate);
  if (!visible.length) return <Text style={{ color: '#526451' }}>Aún no hay posiciones GPS para mostrar en el mapa de flota.</Text>;

  const markers = visible.map((vehicle) => ({
    id: vehicle.entrega_id,
    kind: 'vehicle',
    coordinate: { latitude: Number(vehicle.latitud), longitude: Number(vehicle.longitud) },
    heading: Number(vehicle.rumbo_grados || 0),
    color: markerColor(vehicle.estado_gps),
    title: vehicle.placa || 'Vehículo',
    description: `${vehicle.estado_gps} · GPS ${Number(vehicle.latitud).toFixed(6)}, ${Number(vehicle.longitud).toFixed(6)}${vehicle.precision_m != null ? ` · precisión ±${Math.round(vehicle.precision_m)} m` : ''} · ${vehicle.velocidad_m_s == null ? 'velocidad no disponible' : `${(vehicle.velocidad_m_s * 3.6).toFixed(1)} km/h`}`,
  }));
  const fitKey = `${visible.map((vehicle) => String(vehicle.entrega_id)).sort().join('|')}:${fitRevision}`;

  return <View style={{ height: 340, width: '100%', overflow: 'hidden', borderRadius: 14 }}>
    <MapaAbierto
      style={{ flex: 1 }}
      markers={markers}
      camera={{ fitMode: 'markers', fitKey, zoom: 15, maxZoom: 16, padding: 45 }}
    />
    <TouchableOpacity accessibilityRole="button" onPress={() => setFitRevision((value) => value + 1)} style={{ position: 'absolute', right: 12, top: 12, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: '#17351f', fontWeight: '800' }}>Encuadrar flota</Text></TouchableOpacity>
  </View>;
}
