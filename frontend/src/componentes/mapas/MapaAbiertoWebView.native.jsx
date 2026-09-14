import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { MAPLIBRE_VERSION, OPEN_MAP_STYLE_URL } from '../../configuracion/mapaAbierto';

const HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; connect-src https://tiles.openfreemap.org https://tile.openstreetmap.org; img-src data: blob: https://tiles.openfreemap.org https://tile.openstreetmap.org; font-src data: https://tiles.openfreemap.org; worker-src blob:; child-src blob:">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css'">
<style>
html,body,#map{width:100%;height:100%;margin:0;background:#dfe7e2}.maplibregl-ctrl-attrib{font-size:9px}
.vehicle{width:46px;height:46px;border-radius:50%;background:#fffffff5;box-shadow:0 2px 10px #0005;display:flex;align-items:center;justify-content:center}.arrow{font-size:31px;color:#155eef;line-height:1}
.point{width:22px;height:22px;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 7px #0006}.point.selected{width:28px;height:28px}.maplibregl-popup-content{font:13px sans-serif;padding:9px 11px;color:#17351f}
</style></head><body><div id="map"></div><script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js'"></script><script>
const map=new maplibregl.Map({container:'map',style:'${OPEN_MAP_STYLE_URL}',center:[-74.2973,4.5709],zoom:5,attributionControl:false});
map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'© OpenStreetMap contributors · OpenFreeMap'}));
map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
let loaded=false,route=[],markerState=[],cameraState={},routeFitKey=null,markerFitKey=null;
const markers=new Map();
let animationFrame=null,lastFrame=0,lastError='',lastErrorAt=0;
const rasterFallback={version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm-base',type:'raster',source:'osm'}]};
const send=(message)=>window.ReactNativeWebView.postMessage(JSON.stringify(message));
const safeCoordinate=(coordinate)=>{const latitude=Number(coordinate&&coordinate.latitude),longitude=Number(coordinate&&coordinate.longitude);return Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&Number.isFinite(longitude)&&longitude>=-180&&longitude<=180?[longitude,latitude]:null;};
const markerSignature=(item)=>[item.kind,item.color,item.draggable,Boolean(item.title||item.description)].join('|');
const createMarker=(item,coordinate)=>{
  const element=document.createElement('div');
    if(item.kind==='vehicle') { element.className='vehicle'; element.innerHTML='<span class="arrow">▲</span>'; element.firstChild.style.color=item.color||'#155eef'; }
  else { element.className='point'+(item.kind==='selected'?' selected':''); element.style.backgroundColor=item.color||'#b42318'; }
  const interactive=Boolean(item.draggable||item.title||item.description);element.setAttribute('role',interactive?'button':'img');element.setAttribute('aria-label',(item.title||'Punto del mapa')+(item.draggable?', marcador arrastrable':''));if(interactive)element.tabIndex=0;
  const marker=new maplibregl.Marker({element,anchor:'center',draggable:Boolean(item.draggable)}).setLngLat(coordinate).addTo(map);
  let titleElement,descriptionElement;
  if(item.title||item.description){
    const content=document.createElement('div');
    titleElement=document.createElement('strong'); titleElement.textContent=item.title||''; content.appendChild(titleElement);
    descriptionElement=document.createElement('div'); descriptionElement.textContent=item.description||''; content.appendChild(descriptionElement);
    marker.setPopup(new maplibregl.Popup({offset:18}).setDOMContent(content));element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();marker.togglePopup();}});
  }
  if(item.draggable) marker.on('dragend',()=>{const value=marker.getLngLat();const dragged=[value.lng,value.lat];recordCurrent(marker,dragged);send({type:'marker-drag-end',id:item.id,coordinate:{latitude:value.lat,longitude:value.lng}});});
  return {marker,element,titleElement,descriptionElement,current:coordinate,target:coordinate,signature:markerSignature(item)};
};
const recordCurrent=(marker,coordinate)=>{markers.forEach(record=>{if(record.marker===marker){record.current=coordinate;record.target=coordinate;}});};
const animate=(time)=>{let moving=false;const factor=Math.min(1,(time-lastFrame)/280);markers.forEach(record=>{const dx=record.target[0]-record.current[0],dy=record.target[1]-record.current[1];if(Math.abs(dx)<.0000001&&Math.abs(dy)<.0000001){record.current=record.target;record.marker.setLngLat(record.current);return;}moving=true;record.current=[record.current[0]+dx*factor,record.current[1]+dy*factor];record.marker.setLngLat(record.current);});lastFrame=time;animationFrame=moving?requestAnimationFrame(animate):null;};
const requestMarkerAnimation=()=>{if(animationFrame!==null)return;lastFrame=performance.now();animationFrame=requestAnimationFrame(animate);};
const applyRoute=()=>{
  if(!loaded)return;
  const coordinates=route.map(safeCoordinate).filter(Boolean);
  const data=coordinates.length>1?{type:'Feature',geometry:{type:'LineString',coordinates},properties:{}}:{type:'FeatureCollection',features:[]};
  if(map.getSource('coffee-fly-route'))map.getSource('coffee-fly-route').setData(data);
  else {map.addSource('coffee-fly-route',{type:'geojson',data});map.addLayer({id:'coffee-fly-route-border',type:'line',source:'coffee-fly-route',paint:{'line-color':'#fff','line-width':11,'line-opacity':.94}});map.addLayer({id:'coffee-fly-route-line',type:'line',source:'coffee-fly-route',paint:{'line-color':'#3214d6','line-width':7}});}
  if(cameraState.fitMode==='route'&&coordinates.length>1&&routeFitKey!==cameraState.fitKey){
    routeFitKey=cameraState.fitKey;const bounds=coordinates.reduce((value,coordinate)=>value.extend(coordinate),new maplibregl.LngLatBounds(coordinates[0],coordinates[0]));
    map.fitBounds(bounds,{padding:cameraState.padding||60,maxZoom:cameraState.maxZoom||18,duration:500});
  }
};
const applyMarkers=()=>{
  if(!loaded)return;
  const active=new Set();
  markerState.forEach(item=>{
    const coordinate=safeCoordinate(item.coordinate);if(item.id==null||!coordinate)return;active.add(String(item.id));
    let record=markers.get(String(item.id));
    if(record&&record.signature!==markerSignature(item)){record.marker.remove();markers.delete(String(item.id));record=null;}
    if(!record){record=createMarker(item,coordinate);markers.set(String(item.id),record);}else {record.target=coordinate;requestMarkerAnimation();}
    if(record.titleElement)record.titleElement.textContent=item.title||'';
    if(record.descriptionElement)record.descriptionElement.textContent=item.description||'';
    if(item.kind==='vehicle'){record.element.firstChild.style.transform='rotate('+Number(item.heading||0)+'deg)';record.element.firstChild.style.color=item.color||'#155eef';}
  });
  markers.forEach((record,id)=>{if(!active.has(id)){record.marker.remove();markers.delete(id);}});
  const coordinates=markerState.filter(item=>item.id!=null).map(item=>safeCoordinate(item.coordinate)).filter(Boolean);
  if(cameraState.fitMode==='markers'&&coordinates.length&&markerFitKey!==cameraState.fitKey){
    markerFitKey=cameraState.fitKey;
    if(coordinates.length===1)map.easeTo({center:coordinates[0],zoom:cameraState.zoom||15,duration:450});
    else {const bounds=coordinates.reduce((value,coordinate)=>value.extend(coordinate),new maplibregl.LngLatBounds(coordinates[0],coordinates[0]));map.fitBounds(bounds,{padding:cameraState.padding||45,maxZoom:cameraState.maxZoom||16,duration:500});}
  }
  const followed=markers.get(String(cameraState.followMarkerId||''));
  if(cameraState.follow&&followed)map.easeTo({center:followed.target,zoom:Math.max(cameraState.zoom||17,map.getZoom()),bearing:Number(cameraState.bearing||0),pitch:Number(cameraState.pitch||0),duration:250,essential:true});
};
const receive=(event)=>{try{const message=JSON.parse(event.data);if(message.type==='route'){route=message.route||[];cameraState={...cameraState,...message.camera};applyRoute();}if(message.type==='markers'){markerState=message.markers||[];cameraState={...cameraState,...message.camera};applyMarkers();}}catch(error){send({type:'error',message:error.message});}};
document.addEventListener('message',receive);window.addEventListener('message',receive);
map.on('dragstart',()=>send({type:'camera-interaction',gesture:'drag'}));map.on('zoomstart',event=>{if(event.originalEvent)send({type:'camera-interaction',gesture:'zoom'});});map.on('rotatestart',event=>{if(event.originalEvent)send({type:'camera-interaction',gesture:'rotate'});});
map.on('click',event=>send({type:'map-press',coordinate:{latitude:event.lngLat.lat,longitude:event.lngLat.lng}}));
map.on('error',event=>{const message=event.error&&event.error.message||'No se pudo cargar un recurso del mapa.',now=Date.now();if(message===lastError&&now-lastErrorAt<10000)return;lastError=message;lastErrorAt=now;send({type:'error',fatal:false,message});});
setTimeout(()=>{if(!loaded)map.setStyle(rasterFallback);},10000);
map.on('load',()=>{loaded=true;[['.maplibregl-ctrl-zoom-in','Acercar mapa'],['.maplibregl-ctrl-zoom-out','Alejar mapa'],['.maplibregl-ctrl-compass','Restablecer orientación del mapa']].forEach(([selector,label])=>{const control=document.querySelector(selector);if(control){control.setAttribute('aria-label',label);control.setAttribute('title',label);}});map.getCanvas().setAttribute('aria-label','Superficie interactiva del mapa');applyRoute();applyMarkers();send({type:'ready'});});
</script></body></html>`;

export default function MapaAbierto({ camera = {}, fallback, markers = [], onError, onManualMove, onMapPress, onMarkerDragEnd, route = [], style }) {
  const webRef = useRef(null);
  const readyRef = useRef(false);
  const failureRef = useRef(false);
  const reportedFatalRef = useRef('');
  const [loadError, setLoadError] = useState('');
  const [webViewKey, setWebViewKey] = useState(0);
  const latestRef = useRef({ camera, markers, route });
  latestRef.current = { camera, markers, route };
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
    if (readyRef.current) send('route', { route, camera });
  }, [camera.fitKey, camera.fitMode, route]);

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
    originWhitelist={['about:blank', 'https://unpkg.com', 'https://cdn.jsdelivr.net', 'https://tiles.openfreemap.org', 'https://tile.openstreetmap.org']}
    javaScriptEnabled
    domStorageEnabled
    nestedScrollEnabled
    setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('https://unpkg.com/') || request.url.startsWith('https://cdn.jsdelivr.net/') || request.url.startsWith('https://tiles.openfreemap.org/') || request.url.startsWith('https://tile.openstreetmap.org/')}
    onError={(event) => {
      const message = event.nativeEvent.description || 'No se pudo abrir el mapa.';
      failLoad(message);
    }}
    onMessage={(event) => {
      let message;
      try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
      if (message.type === 'ready') {
        readyRef.current = true;
        failureRef.current = false;
        reportedFatalRef.current = '';
        setLoadError('');
        send('route', { route: latestRef.current.route, camera: latestRef.current.camera });
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
