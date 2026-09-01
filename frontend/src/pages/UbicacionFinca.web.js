import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { enviarOSolicitarEnCola, guardarUbicacionFincaLocal, obtenerUbicacionFincaLocal } from '../services/offline';

export default function UbicacionFinca({ go, token, styles }) {
  const [position, setPosition] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => { obtenerUbicacionFincaLocal().then(setPosition); }, []);
  const guardar = () => {
    if (!navigator.geolocation) return setMessage('Este navegador no permite obtener ubicación. Usa Expo Go en el celular.');
    navigator.geolocation.getCurrentPosition(async (current) => {
      try {
        const payload = { latitud: current.coords.latitude, longitud: current.coords.longitude, fecha: new Date().toISOString() };
        setPosition(payload);
        await guardarUbicacionFincaLocal(payload);
        const result = await enviarOSolicitarEnCola('ubicacion_finca', payload, token);
        setMessage(result.offline ? 'Ubicación guardada localmente para sincronizar.' : 'Ubicación de finca guardada correctamente.');
      } catch (error) { setMessage(error.message); }
    }, () => setMessage('No fue posible obtener tu ubicación. Revisa el permiso del navegador.'), { enableHighAccuracy: true, timeout: 15000 });
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Ubicación de mi finca</Text><Text style={styles.muted}>Guarda el punto de llegada del vehículo.</Text>
    {position ? <View style={styles.card}><Text>Latitud: {position.latitud.toFixed(6)}</Text><Text>Longitud: {position.longitud.toFixed(6)}</Text></View> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={guardar}><Text style={styles.primaryText}>Guardar mi ubicación actual</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
