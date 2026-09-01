import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { NATIVE_MAP_AVAILABLE } from '../config/nativeMaps';

const isValidCoordinate = (vehicle) => Number.isFinite(Number(vehicle?.latitud))
  && Number.isFinite(Number(vehicle?.longitud))
  && Number(vehicle.latitud) >= -90
  && Number(vehicle.latitud) <= 90
  && Number(vehicle.longitud) >= -180
  && Number(vehicle.longitud) <= 180;

const markerColor = (state) => (
  state === 'actualizado' ? '#2e7d32' : state === 'desactualizado' ? '#f57c00' : '#757575'
);

export default function FleetMap({ vehicles = [] }) {
  const mapRef = useRef(null);
  const fleetSignatureRef = useRef('');
  const visible = useMemo(() => vehicles.filter(isValidCoordinate), [vehicles]);
  const coordinates = useMemo(() => visible.map((vehicle) => ({
    latitude: Number(vehicle.latitud),
    longitude: Number(vehicle.longitud),
  })), [visible]);
  const fleetSignature = useMemo(
    () => visible.map((vehicle) => String(vehicle.entrega_id)).sort().join('|'),
    [visible],
  );

  useEffect(() => {
    if (!fleetSignature || fleetSignature === fleetSignatureRef.current) return;
    fleetSignatureRef.current = fleetSignature;
    if (coordinates.length > 1) {
      mapRef.current?.fitToCoordinates(coordinates, {
        animated: true,
        edgePadding: { top: 45, right: 45, bottom: 45, left: 45 },
      });
    } else if (coordinates.length === 1) {
      mapRef.current?.animateToRegion({
        ...coordinates[0], latitudeDelta: 0.04, longitudeDelta: 0.04,
      }, 600);
    }
  }, [coordinates, fleetSignature]);

  if (!visible.length) {
    return <Text style={{ color: '#526451' }}>Aún no hay posiciones GPS para mostrar en el mapa de flota.</Text>;
  }

  if (!NATIVE_MAP_AVAILABLE) {
    return <View style={{ paddingVertical: 8 }}>
      <Text style={{ color: '#293b2b', fontWeight: '700' }}>Flota conectada: {visible.length}</Text>
      <Text style={{ color: '#526451' }}>
        El mapa integrado requiere una clave de Google Maps en el APK. Las posiciones GPS siguen actualizándose.
      </Text>
    </View>;
  }

  const initial = coordinates[0];
  return <View style={{ height: 340, overflow: 'hidden', borderRadius: 14 }}>
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      mapType="none"
      initialRegion={{ ...initial, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
    >
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
      {visible.map((vehicle) => <Marker
        key={vehicle.entrega_id}
        coordinate={{ latitude: Number(vehicle.latitud), longitude: Number(vehicle.longitud) }}
        title={vehicle.placa}
        description={`${vehicle.estado_gps} · ${vehicle.velocidad_m_s == null ? 'velocidad no disponible' : `${(vehicle.velocidad_m_s * 3.6).toFixed(1)} km/h`}`}
        pinColor={markerColor(vehicle.estado_gps)}
      />)}
    </MapView>
  </View>;
}
