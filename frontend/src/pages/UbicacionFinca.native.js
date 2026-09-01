import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';

import { enviarOSolicitarEnCola, guardarUbicacionFincaLocal, obtenerUbicacionFincaLocal } from '../services/offline';

export default function UbicacionFinca({ go, token, styles }) {
  const [position, setPosition] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => { obtenerUbicacionFincaLocal().then(setPosition); }, []);
  const guardar = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw Error('Debes permitir la ubicación para guardar el destino de recolección.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const payload = { latitud: current.coords.latitude, longitud: current.coords.longitude, fecha: new Date().toISOString() };
      setPosition(payload);
      await guardarUbicacionFincaLocal(payload);
      const result = await enviarOSolicitarEnCola('ubicacion_finca', payload, token);
      setMessage(result.offline
        ? 'Ubicación guardada en este celular. Se sincronizará cuando recuperes internet.'
        : 'Ubicación de la finca guardada. El conductor podrá verla antes de iniciar el viaje.');
    } catch (error) { setMessage(error.message); }
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Ubicación de mi finca</Text>
    <Text style={styles.muted}>Párate en el punto donde debe llegar el vehículo y guarda la ubicación. Funciona con GPS; sin internet queda almacenada localmente para sincronizarse después.</Text>
    {position ? <View style={styles.card}><Text style={styles.cardTitle}>Destino capturado</Text><Text>Latitud: {position.latitud.toFixed(6)}</Text><Text>Longitud: {position.longitud.toFixed(6)}</Text></View> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={guardar}><Text style={styles.primaryText}>Guardar mi ubicación actual</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
