import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [4.5709, -74.2973];

const validCoordinate = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
};

export default function TrackingMap({ destination, points = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const vehicleRef = useRef(null);
  const destinationRef = useRef(null);
  const trailRef = useRef(null);
  const trailLengthRef = useRef(0);
  const trailLastRef = useRef(null);
  const animationRef = useRef(null);
  const hasFittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');

  const trail = useMemo(() => points
    .filter((point) => validCoordinate(point.latitud, point.longitud))
    .map((point) => [Number(point.latitud), Number(point.longitud)]), [points]);

  const destinationCoordinate = useMemo(() => {
    if (!destination || !validCoordinate(destination.latitude, destination.longitude)) return null;
    return [Number(destination.latitude), Number(destination.longitude)];
  }, [destination]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver;

    import('leaflet').then(({ default: L }) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const initial = trail.at(-1) || destinationCoordinate || DEFAULT_CENTER;
      const map = L.map(containerRef.current, {
        center: initial,
        zoom: trail.length || destinationCoordinate ? 15 : 6,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => map.invalidateSize(false));
        resizeObserver.observe(containerRef.current);
      }
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(false), 0);
    }).catch(() => {
      if (!disposed) setError('No fue posible cargar el mapa interactivo.');
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      vehicleRef.current = null;
      destinationRef.current = null;
      trailRef.current = null;
      trailLengthRef.current = 0;
      trailLastRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    import('leaflet').then(({ default: L }) => {
      const map = mapRef.current;
      if (disposed || !map || !mapReady) return;

      if (trail.length) {
        if (!trailRef.current) {
          trailRef.current = L.polyline(trail, { color: '#1f7a4d', weight: 5, opacity: 0.85 }).addTo(map);
        } else {
          const previousLength = trailLengthRef.current;
          const previousLast = trailLastRef.current;
          const stillExtendsRoute = previousLength > 0
            && trail.length >= previousLength
            && previousLast
            && trail[previousLength - 1]?.[0] === previousLast[0]
            && trail[previousLength - 1]?.[1] === previousLast[1];
          if (stillExtendsRoute) {
            trail.slice(previousLength).forEach((coordinate) => trailRef.current.addLatLng(coordinate));
          } else {
            trailRef.current.setLatLngs(trail);
          }
        }
        trailLengthRef.current = trail.length;
        trailLastRef.current = trail.at(-1);
        const latest = trail.at(-1);
        if (!vehicleRef.current) {
          vehicleRef.current = L.circleMarker(latest, {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#1976d2',
            fillOpacity: 1,
          }).addTo(map).bindTooltip('Vehículo', { permanent: false });
        } else {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          const origin = vehicleRef.current.getLatLng();
          const started = performance.now();
          const animate = (now) => {
            const progress = Math.min(1, (now - started) / 900);
            const eased = 1 - (1 - progress) ** 3;
            vehicleRef.current?.setLatLng([
              origin.lat + (latest[0] - origin.lat) * eased,
              origin.lng + (latest[1] - origin.lng) * eased,
            ]);
            if (progress < 1) animationRef.current = requestAnimationFrame(animate);
            else animationRef.current = null;
          };
          animationRef.current = requestAnimationFrame(animate);
        }
      }

      if (destinationCoordinate) {
        if (!destinationRef.current) {
          destinationRef.current = L.circleMarker(destinationCoordinate, {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#d84315',
            fillOpacity: 1,
          }).addTo(map).bindTooltip('Destino', { permanent: false });
        } else {
          destinationRef.current.setLatLng(destinationCoordinate);
        }
      }

      const visible = [...trail, ...(destinationCoordinate ? [destinationCoordinate] : [])];
      if (!hasFittedRef.current && visible.length > 1) {
        map.fitBounds(L.latLngBounds(visible), { padding: [36, 36], maxZoom: 16 });
        hasFittedRef.current = true;
      } else if (!hasFittedRef.current && visible.length === 1) {
        map.setView(visible[0], 16);
        hasFittedRef.current = true;
      }
    }).catch(() => setError('No fue posible actualizar el mapa interactivo.'));
    return () => { disposed = true; };
  }, [destinationCoordinate, mapReady, trail]);

  return (
    <View style={{ width: '100%', marginTop: 14, marginBottom: 8 }}>
      <div
        ref={containerRef}
        aria-label="Mapa de seguimiento del vehículo"
        style={{ width: '100%', height: 460, borderRadius: 14, overflow: 'hidden', background: '#e8efe9' }}
      />
      {error ? <Text style={{ color: '#a02b1f', marginTop: 8 }}>{error}</Text> : null}
    </View>
  );
}
