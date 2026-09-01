import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [4.5709, -74.2973];
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
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const fleetSignatureRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const visible = useMemo(() => vehicles.filter(isValidCoordinate), [vehicles]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver;
    import('leaflet').then(({ default: L }) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: 6 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => map.invalidateSize(false));
        resizeObserver.observe(containerRef.current);
      }
      setReady(true);
      window.setTimeout(() => map.invalidateSize(false), 0);
    }).catch(() => !disposed && setError('No fue posible cargar el mapa general de vehículos.'));
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    import('leaflet').then(({ default: L }) => {
      const map = mapRef.current;
      if (disposed || !ready || !map) return;
      const activeIds = new Set(visible.map((vehicle) => String(vehicle.entrega_id)));
      markersRef.current.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });
      visible.forEach((vehicle) => {
        const id = String(vehicle.entrega_id);
        const coordinate = [Number(vehicle.latitud), Number(vehicle.longitud)];
        const tooltip = `${vehicle.placa} · ${vehicle.estado_gps}${vehicle.velocidad_m_s == null ? '' : ` · ${(vehicle.velocidad_m_s * 3.6).toFixed(1)} km/h`}`;
        let marker = markersRef.current.get(id);
        if (!marker) {
          marker = L.circleMarker(coordinate, {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: markerColor(vehicle.estado_gps),
            fillOpacity: 1,
          }).addTo(map).bindTooltip(tooltip);
          markersRef.current.set(id, marker);
        } else {
          marker.setLatLng(coordinate);
          marker.setStyle({ fillColor: markerColor(vehicle.estado_gps) });
          marker.setTooltipContent(tooltip);
        }
      });
      const signature = [...activeIds].sort().join('|');
      if (visible.length && signature !== fleetSignatureRef.current) {
        const bounds = L.latLngBounds(visible.map((vehicle) => [
          Number(vehicle.latitud), Number(vehicle.longitud),
        ]));
        if (visible.length === 1) map.setView(bounds.getCenter(), 16);
        else map.fitBounds(bounds, { padding: [38, 38], maxZoom: 16 });
        fleetSignatureRef.current = signature;
      }
    }).catch(() => setError('No fue posible actualizar el mapa general de vehículos.'));
    return () => { disposed = true; };
  }, [ready, visible]);

  return <View style={{ width: '100%', marginTop: 8, marginBottom: 8 }}>
    <div
      ref={containerRef}
      aria-label="Mapa general de vehículos en camino"
      style={{ width: '100%', height: 400, borderRadius: 14, overflow: 'hidden', background: '#e8efe9' }}
    />
    {!visible.length ? <Text style={{ color: '#526451', marginTop: 8 }}>Aún no hay posiciones GPS para mostrar.</Text> : null}
    {error ? <Text style={{ color: '#a02b1f', marginTop: 8 }}>{error}</Text> : null}
  </View>;
}
