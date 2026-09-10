import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import LocationPicker from '../../componentes/mapas/SelectorUbicacionCooperativa';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { buscarDirecciones, obtenerDireccion } from '../../servicios/busquedaDirecciones';
import { enviarOSolicitarEnCola, guardarUbicacionFincaLocal, obtenerUbicacionFincaLocal } from '../../servicios/sinConexion';
import { styles } from './UbicacionFinca.styles';

export default function FormularioUbicacionFinca({ token, obtenerUbicacionActual }) {
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState('');
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const reverseRequestRef = useRef(0);
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };

  useEffect(() => {
    obtenerUbicacionFincaLocal().then((saved) => {
      if (!saved) return;
      setPosition(saved);
      if (saved.direccion) {
        setAddress(saved.direccion);
        setAddressConfirmed(true);
      } else {
        const requestId = ++reverseRequestRef.current;
        obtenerDireccion(saved.latitud, saved.longitud).then((foundAddress) => {
          if (requestId !== reverseRequestRef.current) return;
          setAddress(foundAddress || 'Punto seleccionado en el mapa');
          setAddressConfirmed(true);
        }).catch(() => {
          if (requestId !== reverseRequestRef.current) return;
          setAddress('Punto seleccionado en el mapa');
          setAddressConfirmed(true);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (addressConfirmed || address.trim().length < 3) {
      setSuggestions([]); setUnknown(false); setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await buscarDirecciones(address, controller.signal);
        setSuggestions(results);
        setUnknown(results.length === 0);
      } catch (error) {
        if (error.name !== 'AbortError') setMessage(error.message);
      } finally { setSearching(false); }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [address, addressConfirmed]);

  const selectPosition = (selected, selectedAddress) => {
    setPosition({ latitud: selected.latitude, longitud: selected.longitude });
    setAddress(selectedAddress);
    setAddressConfirmed(true);
    setSuggestions([]);
    setUnknown(false);
  };

  const selectMapPosition = async (selected) => {
    const requestId = ++reverseRequestRef.current;
    setPosition({ latitud: selected.latitude, longitud: selected.longitude });
    setAddress('Buscando dirección del punto...');
    setAddressConfirmed(false);
    setSuggestions([]); setUnknown(false);
    try {
      const foundAddress = await obtenerDireccion(selected.latitude, selected.longitude);
      if (requestId !== reverseRequestRef.current) return;
      setAddress(foundAddress || 'Punto seleccionado en el mapa');
    } catch {
      if (requestId !== reverseRequestRef.current) return;
      setAddress('Punto seleccionado en el mapa');
    }
    setAddressConfirmed(true);
  };

  const useCurrentPosition = async () => {
    try {
      const current = await obtenerUbicacionActual();
      await selectMapPosition(current);
      setMessage('Ubicación actual seleccionada. Puedes ajustar el marcador en el mapa.', 'success');
    } catch (error) { setMessage(error.message); }
  };

  const save = async () => {
    if (!position || !addressConfirmed) return setMessage('Selecciona una sugerencia o un punto válido en el mapa.');
    try {
      const payload = { ...position, direccion: address, fecha: new Date().toISOString() };
      await guardarUbicacionFincaLocal(payload);
      const result = await enviarOSolicitarEnCola('ubicacion_finca', payload, token);
      setMessage(result.offline
        ? 'Ubicación guardada localmente. Se sincronizará cuando recuperes internet.'
        : 'Ubicación y dirección de la finca guardadas correctamente.', result.offline ? 'warning' : 'success');
    } catch (error) { setMessage(error.message); }
  };

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Ubicación de mi finca</Text>
    <Text style={styles.muted}>Escribe una dirección y elige una sugerencia, o toca el mapa para marcar el punto exacto donde debe llegar el vehículo.</Text>
    <Text style={styles.label}>Dirección o punto cercano</Text>
    <TextInput
      style={styles.input}
      value={address}
      onChangeText={(value) => { reverseRequestRef.current += 1; setAddress(value); setAddressConfirmed(false); setPosition(null); }}
      placeholder="Ejemplo: Vereda El Carmen, Armenia"
      autoCorrect={false}
    />
    {searching ? <Text style={styles.muted}>Buscando lugares cercanos...</Text> : null}
    {unknown ? <FeedbackMessage type="warning">Ubicación desconocida</FeedbackMessage> : null}
    {suggestions.length ? <View style={styles.suggestions}>{suggestions.map((suggestion) => <TouchableOpacity key={`${suggestion.latitude}-${suggestion.longitude}-${suggestion.direccion}`} style={styles.suggestion} onPress={() => selectPosition(suggestion, suggestion.direccion)}><Text style={styles.suggestionText}>{suggestion.direccion}</Text></TouchableOpacity>)}</View> : null}
    <LocationPicker latitude={position?.latitud} longitude={position?.longitud} onSelect={selectMapPosition} entityLabel="finca" />
    {position ? <View style={styles.card}>
      <Text style={styles.cardTitle}>Punto seleccionado</Text>
      <Text>{address}</Text>
      <Text style={styles.muted}>{position.latitud.toFixed(6)}, {position.longitud.toFixed(6)}</Text>
    </View> : null}
    {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}
    <TouchableOpacity style={styles.statusButton} onPress={useCurrentPosition}><Text style={styles.statusButtonText}>Usar mi ubicación actual</Text></TouchableOpacity>
    <TouchableOpacity style={[styles.primary, (!position || !addressConfirmed) && styles.unavailable]} disabled={!position || !addressConfirmed} onPress={save}><Text style={styles.primaryText}>Guardar ubicación de la finca</Text></TouchableOpacity>
    <Text style={styles.attribution}>Sugerencias geográficas: Photon y colaboradores de OpenStreetMap.</Text>
  </ScrollView>;
}
