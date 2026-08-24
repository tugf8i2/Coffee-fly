import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config/Api';

export default function SeguimientoVehiculo({ go, token, styles }) {
  const [tracking, setTracking] = useState(null); const [error, setError] = useState('');
  const load = async () => { try { const r = await fetch(`${API_BASE_URL}/solicitudes/mi-seguimiento`, {headers:{Authorization:`Bearer ${token}`}}); const d = await r.json(); if (!r.ok) throw Error(d.detail || 'No se pudo consultar el seguimiento'); setTracking(d); } catch(e) { setError(e.message); } };
  useEffect(()=>{load();},[]);
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>Seguimiento de mi vehículo</Text><Text style={styles.muted}>Solo puedes ver el vehículo asignado a tu solicitud activa.</Text>{error?<Text style={styles.error}>{error}</Text>:null}{tracking?<><View style={[styles.card,{backgroundColor:'#386641',minHeight:210,justifyContent:'center',alignItems:'center'}]}><Text style={{fontSize:52}}>🚚</Text><Text style={{color:'#fff',fontWeight:'800',fontSize:18}}>Vehículo en ruta</Text><Text style={{color:'#fff'}}>● Ubicación GPS vigente</Text><Text style={{color:'#fff'}}>Lat {tracking.ubicacion.latitud} · Long {tracking.ubicacion.longitud}</Text></View><View style={styles.card}><Text style={styles.cardTitle}>Asignación actual</Text><Text>Solicitud: {tracking.id_solicitud.slice(0,8)}</Text><Text>Vehículo asignado: #{tracking.vehiculo_id}</Text><Text>Estado: {tracking.estado_solicitud}</Text><Text>Carga: {tracking.peso_kg} kg</Text><Text style={styles.muted}>Ubicación actualizada para la solicitud asignada.</Text></View></>:null}<TouchableOpacity style={styles.primary} onPress={load}><Text style={styles.primaryText}>Actualizar ubicación</Text></TouchableOpacity><TouchableOpacity onPress={()=>go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity></ScrollView>;
}
