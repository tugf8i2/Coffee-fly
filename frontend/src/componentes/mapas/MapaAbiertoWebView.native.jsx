import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://unpkg.com; script-src 'unsafe-inline' https://unpkg.com; img-src data: https://tile.openstreetmap.org">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{width:100%;height:100%;margin:0;background:#dfe7e2}.leaflet-control-attribution{font-size:8px!important}
.vehicle{width:42px;height:42px;border-radius:50%;background:#fffffff5;box-shadow:0 2px 10px #0005;display:flex;align-items:center;justify-content:center}.arrow{font-size:29px;color:#155eef;line-height:1}
.point{width:20px;height:20px;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 7px #0006}.point.selected{width:26px;height:26px}.leaflet-div-icon{background:transparent;border:0;transition:transform 70ms linear}.leaflet-popup-content{font:13px sans-serif;color:#17351f}
body.dark .leaflet-tile-pane{filter:brightness(.58) contrast(1.12) saturate(.72)}body.dark .leaflet-control{filter:none}
</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const send=(message)=>window.ReactNativeWebView.postMessage(JSON.stringify(message));
if(typeof L==='undefined'){send({type:'error',fatal:true,message:'No fue posible iniciar el mapa de calles.'});throw new Error('Leaflet unavailable');}
const map=L.map('map',{zoomControl:true,attributionControl:true}).setView([4.5709,-74.2973],5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
map.zoomControl.setPosition('bottomright');
let routeColor='#3214d6',routeWidth=7,route=[],completedRoute=[],markerState=[],cameraState={},routeFitKey=null,markerFitKey=null,routeLines=[];
const markers=new Map();
const safeCoordinate=(coordinate)=>{const latitude=Number(coordinate&&coordinate.latitude),longitude=Number(coordinate&&coordinate.longitude);return Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&Number.isFinite(longitude)&&longitude>=-180&&longitude<=180?[latitude,longitude]:null;};
const signature=(item)=>[item.kind,item.size,item.color,item.draggable].join('|');
const escapeHtml=(value)=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const iconFor=(item)=>{const color=item.color||(item.kind==='vehicle'?'#155eef':'#b42318');const selected=item.kind==='selected';const size=item.kind==='vehicle'?[item.size||42,item.size||42]:item.kind==='destination'?[44,58]:selected?[32,32]:[26,26];const html=item.kind==='vehicle'?'<div class="vehicle" style="width:'+size[0]+'px;height:'+size[1]+'px"><span class="arrow" style="font-size:'+Math.round(size[0]*.67)+'px;color:'+escapeHtml(color)+';transform:rotate('+Number(item.heading||0)+'deg)">▲</span></div>':item.kind==='destination'?'<svg viewBox="0 0 44 58"><path d="M22 56S2 34 2 22a20 20 0 0 1 40 0c0 12-20 34-20 34Z" fill="'+escapeHtml(color)+'" stroke="white" stroke-width="3"/><circle cx="22" cy="22" r="8" fill="white"/></svg>':'<div class="point'+(selected?' selected':'')+'" style="background:'+escapeHtml(color)+'"></div>';return L.divIcon({className:'',html,iconSize:size,iconAnchor:[size[0]/2,item.kind==='destination'?size[1]:size[1]/2]});};
const createMarker=(item,coordinate)=>{const marker=L.marker(coordinate,{draggable:Boolean(item.draggable),icon:iconFor(item)}).addTo(map);if(item.draggable)marker.on('dragend',()=>{const value=marker.getLatLng();send({type:'marker-drag-end',id:item.id,coordinate:{latitude:value.lat,longitude:value.lng}});});return {marker,signature:signature(item)};};
const applyRoute=()=>{const coordinates=route.map(safeCoordinate).filter(Boolean),completed=completedRoute.map(safeCoordinate).filter(Boolean);routeLines.forEach(line=>line.remove());routeLines=[];if(coordinates.length>1)routeLines=[L.polyline(coordinates,{color:'#fff',weight:routeWidth+4,opacity:.94}).addTo(map),L.polyline(coordinates,{color:routeColor,weight:routeWidth}).addTo(map)];if(completed.length>1)routeLines.push(L.polyline(completed,{color:'#7b8f80',weight:7,opacity:.95}).addTo(map));if(cameraState.fitMode==='route'&&coordinates.length>1&&routeFitKey!==cameraState.fitKey){routeFitKey=cameraState.fitKey;map.fitBounds(coordinates,{padding:[60,60],maxZoom:cameraState.maxZoom||18,animate:true});}};
const applyMarkers=()=>{const active=new Set();markerState.forEach(item=>{const coordinate=safeCoordinate(item.coordinate);if(item.id==null||!coordinate)return;const id=String(item.id);active.add(id);let record=markers.get(id);if(record&&record.signature!==signature(item)){record.marker.remove();markers.delete(id);record=null;}if(!record){record=createMarker(item,coordinate);markers.set(id,record);}else{record.marker.setLatLng(coordinate);const arrow=record.marker.getElement()&&record.marker.getElement().querySelector('.arrow');if(arrow){arrow.style.transform='rotate('+Number(item.heading||0)+'deg)';arrow.style.color=item.color||'#155eef';}}if(item.title||item.description)record.marker.bindPopup('<strong>'+escapeHtml(item.title)+'</strong><div>'+escapeHtml(item.description)+'</div>');});markers.forEach((record,id)=>{if(!active.has(id)){record.marker.remove();markers.delete(id);}});const coordinates=markerState.filter(item=>item.id!=null).map(item=>safeCoordinate(item.coordinate)).filter(Boolean);if(cameraState.fitMode==='markers'&&coordinates.length&&markerFitKey!==cameraState.fitKey){markerFitKey=cameraState.fitKey;if(coordinates.length===1)map.setView(coordinates[0],cameraState.zoom||15,{animate:false});else map.fitBounds(coordinates,{padding:[45,45],maxZoom:cameraState.maxZoom||16,animate:true});}const followed=markers.get(String(cameraState.followMarkerId||''));if(cameraState.follow&&followed)map.setView(followed.marker.getLatLng(),cameraState.zoom||17,{animate:false});};
const receive=(event)=>{try{const message=JSON.parse(event.data);if(message.type==='route'){routeColor=message.routeColor||'#3214d6';routeWidth=message.routeWidth||7;route=message.route||[];completedRoute=message.completedRoute||[];cameraState={...cameraState,...message.camera};document.body.classList.toggle('dark',message.mapTheme==='dark');if(message.showNavigationControls===false)map.zoomControl.remove();else map.zoomControl.addTo(map);applyRoute();}if(message.type==='markers'){markerState=message.markers||[];cameraState={...cameraState,...message.camera};applyMarkers();}}catch(error){send({type:'error',fatal:false,message:error.message});}};
document.addEventListener('message',receive);window.addEventListener('message',receive);
map.on('dragstart',event=>{if(event.originalEvent)send({type:'camera-interaction',gesture:'drag'});});map.on('zoomstart',event=>{if(event.originalEvent)send({type:'camera-interaction',gesture:'zoom'});});
map.on('click',event=>send({type:'map-press',coordinate:{latitude:event.latlng.lat,longitude:event.latlng.lng}}));
setTimeout(()=>{map.invalidateSize();applyRoute();applyMarkers();send({type:'ready'});},100);
</script></body></html>`;

export default function MapaAbierto({ camera = {}, completedRoute = [], fallback, mapTheme = 'day', showNavigationControls = true, markers = [], onError, onManualMove, onMapPress, onMarkerDragEnd, route = [], routeColor = '#3214d6', routeWidth = 7, style }) {
  const webRef = useRef(null);
  const readyRef = useRef(false);
  const failureRef = useRef(false);
  const reportedFatalRef = useRef('');
  const [loadError, setLoadError] = useState('');
  const [webViewKey, setWebViewKey] = useState(0);
  const latestRef = useRef({ camera, completedRoute, mapTheme, markers, route, routeColor, routeWidth, showNavigationControls });
  latestRef.current = { camera, completedRoute, mapTheme, markers, route, routeColor, routeWidth, showNavigationControls };
  const send = (type, payload) => webRef.current?.postMessage(JSON.stringify({ type, ...payload }));
  const failLoad = (message) => {
    if (failureRef.current) return;
    failureRef.current = true;
    readyRef.current = false;
    if (reportedFatalRef.current !== message) {
      reportedFatalRef.current = message;
      onError?.(message);
    }
    setLoadError(message);
  };

  useEffect(() => {
    if (readyRef.current) send('route', { route, completedRoute, mapTheme, camera, routeColor, routeWidth, showNavigationControls });
  }, [camera.fitKey, camera.fitMode, completedRoute, mapTheme, route, routeColor, routeWidth, showNavigationControls]);

  useEffect(() => {
    if (readyRef.current) send('markers', { markers, camera });
  }, [camera.bearing, camera.fitKey, camera.fitMode, camera.follow, camera.followMarkerId, camera.pitch, camera.zoom, markers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!readyRef.current) failLoad('No fue posible cargar el mapa abierto.');
    }, 22000);
    return () => clearTimeout(timer);
  }, [webViewKey]);

  if (loadError) return <View style={[style, { backgroundColor: '#e8efe9', alignItems: 'stretch', justifyContent: 'center', padding: 12 }]}>
    {fallback || <Text style={{ color: '#526451', textAlign: 'center' }}>Mapa sin conexión. Las coordenadas GPS continúan actualizándose.</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar el mapa" onPress={() => {
      failureRef.current = false;
      reportedFatalRef.current = '';
      setLoadError('');
      setWebViewKey((value) => value + 1);
    }} style={{ alignSelf: 'center', marginTop: 12, backgroundColor: '#386641', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar mapa</Text>
    </Pressable>
  </View>;

  return <WebView
    key={webViewKey}
    ref={webRef}
    style={style}
    accessible
    accessibilityLabel="Mapa abierto interactivo de Coffee Fly"
    source={{ html: HTML }}
    originWhitelist={['about:blank', 'https://unpkg.com', 'https://tile.openstreetmap.org']}
    javaScriptEnabled
    domStorageEnabled
    nestedScrollEnabled
    setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('https://unpkg.com/') || request.url.startsWith('https://tile.openstreetmap.org/')}
    onError={(event) => failLoad(event.nativeEvent.description || 'No se pudo abrir el mapa.')}
    onMessage={(event) => {
      let message;
      try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
      if (message.type === 'ready') {
        readyRef.current = true;
        failureRef.current = false;
        reportedFatalRef.current = '';
        setLoadError('');
        send('route', { routeColor: latestRef.current.routeColor, routeWidth: latestRef.current.routeWidth, showNavigationControls: latestRef.current.showNavigationControls, route: latestRef.current.route, completedRoute: latestRef.current.completedRoute, mapTheme: latestRef.current.mapTheme, camera: latestRef.current.camera });
        send('markers', { markers: latestRef.current.markers, camera: latestRef.current.camera });
      }
      if (message.type === 'camera-interaction') onManualMove?.(message.gesture);
      if (message.type === 'map-press') onMapPress?.(message.coordinate);
      if (message.type === 'marker-drag-end') onMarkerDragEnd?.(message.id, message.coordinate);
      if (message.type === 'error' && message.fatal) failLoad(message.message);
      else if (message.type === 'error') onError?.(message.message);
    }}
  />;
}
