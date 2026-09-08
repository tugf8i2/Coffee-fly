import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [4.5709, -74.2973];

const validCoordinate = (latitude, longitude) => Number.isFinite(Number(latitude))
  && Number.isFinite(Number(longitude))
  && Number(latitude) >= -90
  && Number(latitude) <= 90
  && Number(longitude) >= -180
  && Number(longitude) <= 180;

export default function SelectorUbicacionCooperativa({ latitude, longitude, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver;
    import('leaflet').then(({ default: L }) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const initial = validCoordinate(latitude, longitude)
        ? [Number(latitude), Number(longitude)]
        : DEFAULT_CENTER;
      const map = L.map(containerRef.current, { center: initial, zoom: validCoordinate(latitude, longitude) ? 16 : 6 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      map.on('click', ({ latlng }) => onSelectRef.current?.({ latitude: latlng.lat, longitude: latlng.lng }));
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => map.invalidateSize(false));
        resizeObserver.observe(containerRef.current);
      }
      setReady(true);
      window.setTimeout(() => map.invalidateSize(false), 0);
    }).catch(() => !disposed && setError('No fue posible cargar el mapa interactivo.'));
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !validCoordinate(latitude, longitude)) return;
    let disposed = false;
    import('leaflet').then(({ default: L }) => {
      if (disposed || !mapRef.current) return;
      const coordinate = [Number(latitude), Number(longitude)];
      if (!markerRef.current) {
        markerRef.current = L.circleMarker(coordinate, {
          radius: 10, color: '#ffffff', weight: 3, fillColor: '#386641', fillOpacity: 1,
        }).addTo(mapRef.current).bindTooltip('Ubicación de la cooperativa');
      } else markerRef.current.setLatLng(coordinate);
      mapRef.current.setView(coordinate, Math.max(mapRef.current.getZoom(), 16));
    }).catch(() => !disposed && setError('No fue posible actualizar el punto seleccionado.'));
    return () => { disposed = true; };
  }, [latitude, longitude, ready]);

  return <View style={{ width: '100%', gap: 7 }}>
    <Text style={{ color: '#386641', fontWeight: '700' }}>Haz clic sobre el mapa para ubicar la cooperativa.</Text>
    <div ref={containerRef} aria-label="Mapa para elegir la ubicación de la cooperativa" style={{ width: '100%', height: 380, borderRadius: 14, overflow: 'hidden', background: '#e8efe9' }} />
    <Text style={{ color: '#526451', fontSize: 12 }}>Mapa y datos cartográficos © colaboradores de OpenStreetMap.</Text>
    {error ? <Text style={{ color: '#a02b1f' }}>{error}</Text> : null}
  </View>;
}
