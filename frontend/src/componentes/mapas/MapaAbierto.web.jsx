import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAPLIBRE_WORKER_URL,
  OPEN_STREET_MAP_RASTER_STYLE,
} from '../../configuracion/mapaAbierto';

const validCoordinate = (coordinate) => Number.isFinite(Number(coordinate?.latitude))
  && Number.isFinite(Number(coordinate?.longitude))
  && Number(coordinate.latitude) >= -90 && Number(coordinate.latitude) <= 90
  && Number(coordinate.longitude) >= -180 && Number(coordinate.longitude) <= 180;
const lngLat = (coordinate) => [Number(coordinate.longitude), Number(coordinate.latitude)];
const markerSignature = (marker) => [marker.kind, marker.color, marker.draggable, Boolean(marker.title || marker.description)].join('|');
const MAX_LOAD_RETRIES = 2;

export default function MapaAbierto({ camera = {}, fallback, markers = [], onError, onManualMove, onMapPress, onMarkerDragEnd, route = [], style }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRecordsRef = useRef(new Map());
  const routeFitKeyRef = useRef(null);
  const markerFitKeyRef = useRef(null);
  const animationRef = useRef(null);
  const startAnimationRef = useRef(() => {});
  const reportedFatalRef = useRef('');
  const callbackRef = useRef({ onError, onManualMove, onMapPress, onMarkerDragEnd });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [fatalError, setFatalError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  callbackRef.current = { onError, onManualMove, onMapPress, onMarkerDragEnd };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let disposed = false;
    let loaded = false;
    let failed = false;
    let map;
    let retryTimer;
    let transientErrorTimer;
    let lastReportedError = '';
    let lastReportedAt = 0;
    const initialCoordinate = [...route].reverse().find(validCoordinate)
      || markers.find((item) => validCoordinate(item.coordinate))?.coordinate;
    const reportFatal = (failure) => {
      if (disposed || failed) return;
      failed = true;
      const message = failure?.message || failure || 'No fue posible cargar el mapa abierto.';
      if (reportedFatalRef.current !== message) {
        reportedFatalRef.current = message;
        callbackRef.current.onError?.(message);
      }
      if (retryCount < MAX_LOAD_RETRIES) {
        setError(`${message} Reintentando...`);
        retryTimer = setTimeout(() => {
          if (!disposed) setRetryCount((value) => value + 1);
        }, 1000 * (retryCount + 1));
      } else {
        setError('');
        setFatalError(message);
      }
    };
    try {
      // Expo exporta el bundle principal, pero no el worker calculado por el
      // import.meta.url de MapLibre. Fijar una URL publica evita que Nginx
      // responda index.html al solicitar maplibre-gl-worker.mjs.
      maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
      map = new maplibregl.Map({
        container: containerRef.current,
        // La capa raster muestra calles de forma directa y evita depender del
        // estilo vectorial externo, que puede fallar o cargar solo el relieve.
        style: OPEN_STREET_MAP_RASTER_STYLE,
        center: initialCoordinate ? lngLat(initialCoordinate) : DEFAULT_MAP_CENTER,
        zoom: initialCoordinate ? 15 : DEFAULT_MAP_ZOOM,
        attributionControl: false,
      });
    } catch (mapError) {
      reportFatal(mapError?.message || 'Este navegador no pudo iniciar el mapa.');
      return () => { disposed = true; clearTimeout(retryTimer); };
    }
    setReady(false);
    setError('');
    setFatalError('');
    routeFitKeyRef.current = null;
    markerFitKeyRef.current = null;
    const loadTimer = setTimeout(() => reportFatal('No fue posible cargar el mapa abierto.'), 12000);
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap contributors · OpenFreeMap' }));
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');
    [
      ['.maplibregl-ctrl-zoom-in', 'Acercar mapa'],
      ['.maplibregl-ctrl-zoom-out', 'Alejar mapa'],
      ['.maplibregl-ctrl-compass', 'Restablecer orientación del mapa'],
    ].forEach(([selector, label]) => {
      const control = containerRef.current?.querySelector(selector);
      control?.setAttribute('aria-label', label);
      control?.setAttribute('title', label);
    });
    map.getCanvas().setAttribute('aria-label', 'Superficie interactiva del mapa');
    map.on('load', () => {
      loaded = true;
      failed = false;
      clearTimeout(loadTimer);
      clearTimeout(retryTimer);
      setReady(true);
      setError('');
      setFatalError('');
      reportedFatalRef.current = '';
    });
    map.on('click', (event) => callbackRef.current.onMapPress?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    map.on('dragstart', () => callbackRef.current.onManualMove?.('drag'));
    map.on('zoomstart', (event) => { if (event.originalEvent) callbackRef.current.onManualMove?.('zoom'); });
    map.on('rotatestart', (event) => { if (event.originalEvent) callbackRef.current.onManualMove?.('rotate'); });
    map.on('error', (event) => {
      const message = event.error?.message || 'No fue posible actualizar el mapa.';
      if (!loaded) return;
      const now = Date.now();
      if (message === lastReportedError && now - lastReportedAt < 10000) return;
      lastReportedError = message;
      lastReportedAt = now;
      callbackRef.current.onError?.(message);
      setError('Algunos datos del mapa no se pudieron cargar. Se seguirá intentando.');
      clearTimeout(transientErrorTimer);
      transientErrorTimer = setTimeout(() => { if (!disposed) setError(''); }, 5000);
    });
    mapRef.current = map;
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.resize());
    resizeObserver?.observe(containerRef.current);
    let lastFrame = 0;
    const animate = (time) => {
      let moving = false;
      const factor = Math.min(1, (time - lastFrame) / 280);
      markerRecordsRef.current.forEach((record) => {
        const longitudeDelta = record.target[0] - record.current[0];
        const latitudeDelta = record.target[1] - record.current[1];
        if (Math.abs(longitudeDelta) < 0.0000001 && Math.abs(latitudeDelta) < 0.0000001) {
          record.current = record.target;
          record.marker.setLngLat(record.current);
          return;
        }
        moving = true;
        record.current = [
          record.current[0] + longitudeDelta * factor,
          record.current[1] + latitudeDelta * factor,
        ];
        record.marker.setLngLat(record.current);
      });
      lastFrame = time;
      animationRef.current = moving ? requestAnimationFrame(animate) : null;
    };
    startAnimationRef.current = () => {
      if (animationRef.current != null) return;
      lastFrame = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    };
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      clearTimeout(loadTimer);
      clearTimeout(retryTimer);
      clearTimeout(transientErrorTimer);
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      startAnimationRef.current = () => {};
      markerRecordsRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [retryCount]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const coordinates = route.filter(validCoordinate).map(lngLat);
    const data = coordinates.length > 1
      ? { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }
      : { type: 'FeatureCollection', features: [] };
    if (map.getSource('coffee-fly-route')) map.getSource('coffee-fly-route').setData(data);
    else {
      map.addSource('coffee-fly-route', { type: 'geojson', data });
      map.addLayer({ id: 'coffee-fly-route-border', type: 'line', source: 'coffee-fly-route', paint: { 'line-color': '#fff', 'line-width': 11, 'line-opacity': 0.94 } });
      map.addLayer({ id: 'coffee-fly-route-line', type: 'line', source: 'coffee-fly-route', paint: { 'line-color': '#3214d6', 'line-width': 7 } });
    }
    if (camera.fitMode === 'route' && coordinates.length > 1 && routeFitKeyRef.current !== camera.fitKey) {
      routeFitKeyRef.current = camera.fitKey;
      const bounds = coordinates.reduce((value, coordinate) => value.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
      map.fitBounds(bounds, { padding: camera.padding || 60, maxZoom: camera.maxZoom || 18, duration: 500 });
    }
  }, [camera.fitKey, camera.fitMode, camera.maxZoom, camera.padding, ready, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const visible = markers.filter((item) => item.id != null && validCoordinate(item.coordinate));
    const active = new Set(visible.map((item) => String(item.id)));
    markerRecordsRef.current.forEach((record, id) => {
      if (!active.has(id)) { record.marker.remove(); markerRecordsRef.current.delete(id); }
    });
    visible.forEach((item) => {
      const id = String(item.id);
      const coordinate = lngLat(item.coordinate);
      let record = markerRecordsRef.current.get(id);
      if (record && record.signature !== markerSignature(item)) {
        record.marker.remove(); markerRecordsRef.current.delete(id); record = null;
      }
      if (!record) {
        const element = document.createElement('div');
        if (item.kind === 'vehicle') {
          element.style.cssText = 'width:46px;height:46px;border-radius:50%;background:#fffffff5;box-shadow:0 2px 10px #0005;display:flex;align-items:center;justify-content:center';
          const arrow = document.createElement('span');
          arrow.textContent = '▲'; arrow.style.cssText = `font-size:31px;line-height:1;color:${item.color || '#155eef'}`; element.appendChild(arrow);
        } else {
          const size = item.kind === 'selected' ? 28 : 22;
          element.style.cssText = `width:${size}px;height:${size}px;border:3px solid #fff;border-radius:50%;background:${item.color || '#b42318'};box-shadow:0 2px 7px #0006`;
        }
        const interactive = Boolean(item.draggable || item.title || item.description);
        element.setAttribute('role', interactive ? 'button' : 'img');
        element.setAttribute('aria-label', `${item.title || 'Punto del mapa'}${item.draggable ? ', marcador arrastrable' : ''}`);
        if (interactive) element.tabIndex = 0;
        const marker = new maplibregl.Marker({ element, anchor: 'center', draggable: Boolean(item.draggable) }).setLngLat(coordinate).addTo(map);
        let titleElement;
        let descriptionElement;
        if (item.title || item.description) {
          const content = document.createElement('div');
          titleElement = document.createElement('strong'); titleElement.textContent = item.title || ''; content.appendChild(titleElement);
          descriptionElement = document.createElement('div'); descriptionElement.textContent = item.description || ''; content.appendChild(descriptionElement);
          marker.setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(content));
          element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); marker.togglePopup(); }
          });
        }
        if (item.draggable) marker.on('dragend', () => {
          const value = marker.getLngLat();
          record.current = [value.lng, value.lat];
          record.target = record.current;
          callbackRef.current.onMarkerDragEnd?.(item.id, { latitude: value.lat, longitude: value.lng });
        });
        record = { marker, element, titleElement, descriptionElement, current: coordinate, target: coordinate, signature: markerSignature(item) };
        markerRecordsRef.current.set(id, record);
      } else {
        record.target = coordinate;
        startAnimationRef.current();
      }
      if (record.titleElement) record.titleElement.textContent = item.title || '';
      if (record.descriptionElement) record.descriptionElement.textContent = item.description || '';
      if (item.kind === 'vehicle' && record.element.firstChild) {
        record.element.firstChild.style.transform = `rotate(${Number(item.heading || 0)}deg)`;
        record.element.firstChild.style.color = item.color || '#155eef';
      }
    });
    const coordinates = visible.map((item) => lngLat(item.coordinate));
    if (camera.fitMode === 'markers' && coordinates.length && markerFitKeyRef.current !== camera.fitKey) {
      markerFitKeyRef.current = camera.fitKey;
      if (coordinates.length === 1) map.easeTo({ center: coordinates[0], zoom: camera.zoom || 15, duration: 450 });
      else {
        const bounds = coordinates.reduce((value, coordinate) => value.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
        map.fitBounds(bounds, { padding: camera.padding || 45, maxZoom: camera.maxZoom || 16, duration: 500 });
      }
    }
    const followed = markerRecordsRef.current.get(String(camera.followMarkerId || ''));
    if (camera.follow && followed) map.easeTo({
      center: followed.target,
      zoom: Math.max(camera.zoom || 17, map.getZoom()),
      bearing: Number(camera.bearing || 0),
      pitch: Number(camera.pitch || 0),
      duration: 250,
      essential: true,
    });
  }, [camera.bearing, camera.fitKey, camera.fitMode, camera.follow, camera.followMarkerId, camera.maxZoom, camera.padding, camera.pitch, camera.zoom, markers, ready]);

  return <View style={[{ width: '100%', overflow: 'hidden' }, style]}>
    <div ref={containerRef} role="region" tabIndex={0} aria-label="Mapa abierto interactivo de Coffee Fly. Usa los controles para acercar, alejar y orientar." style={{ width: '100%', height: '100%', background: '#e8efe9' }} />
    {error ? <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 12, bottom: 12, color: '#a02b1f', backgroundColor: '#fff', padding: 6 }}>{error}</Text> : null}
    {fatalError ? <View style={{ position: 'absolute', inset: 0, backgroundColor: '#e8efe9', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {fallback || <Text style={{ color: '#526451', textAlign: 'center' }}>Mapa sin conexión. Las coordenadas GPS continúan disponibles.</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar el mapa" onPress={() => { reportedFatalRef.current = ''; setFatalError(''); setRetryCount(0); }} style={{ marginTop: 12, backgroundColor: '#386641', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar mapa</Text>
      </Pressable>
    </View> : null}
  </View>;
}
